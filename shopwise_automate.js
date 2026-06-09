#!/usr/bin/env node
/**
 * ShopWise (Giftstacc) voucher automation — runnable CLI + HTTP service.
 *
 * Buys gift vouchers on https://shopwise.giftstacc.com end-to-end:
 *   login (mobile + OTP) -> product -> denominations -> Continue -> Buy now
 *   -> PayU saved card -> PAY NOW -> Amex SafeKey 3DS -> order confirmation -> voucher code.
 *
 * OTPs (login + SafeKey) are fetched automatically from n8n, which receives them
 * from the phone via the iOS Shortcut -> webhook relay. See SHOPWISE_FLOW.md.
 *
 * USAGE
 *   node shopwise_automate.js --plan shopwise-plan.example.json        # run a full plan
 *   node shopwise_automate.js --plan plan.json --dry-run               # everything except paying (no charge)
 *   node shopwise_automate.js --plan plan.json --only 0                # run only job index 0
 *   HEADLESS=false node shopwise_automate.js --plan plan.json          # watch it run
 *   node shopwise_automate.js --serve                                  # HTTP service on :3000 (POST /run {plan})
 *
 * REQUIRED ENV (.env): MOBILE, N8N_BASE_URL  (e.g. https://n8n.harshit.cloud)
 * OPTIONAL ENV: WEBHOOK_PATH, SHOPWISE_BASE_URL, SHOPWISE_LOGIN_URL, HEADLESS,
 *               MANUAL_3DS=true (pause for human to complete the SafeKey step; OTP is printed for you)
 */
const fs = require('fs')
const express = require('express')
const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const axios = require('axios')
require('dotenv').config()
chromium.use(StealthPlugin())

const {
  MOBILE,
  N8N_BASE_URL,
  WEBHOOK_PATH = '/webhook/ios-sms',
  SHOPWISE_BASE_URL = 'https://shopwise.giftstacc.com',
  SHOPWISE_LOGIN_URL = 'https://sso.ai-loyalty.com/Login/GIFT-AMX-PRDSTACC-20251008',
  HEADLESS = 'true',
  MANUAL_3DS = 'false',
} = process.env

const HEADFUL = String(HEADLESS).toLowerCase() === 'false'
const MANUAL = String(MANUAL_3DS).toLowerCase() === 'true'
const log = (...a) => console.log(new Date().toISOString(), ...a)

// ============================ n8n OTP relay ============================
async function getState() {
  try {
    const res = await axios.post(`${N8N_BASE_URL}${WEBHOOK_PATH}`, { message: '__GET_STATE__', type: 'status_check' }, { timeout: 6000 })
    return res.data
  } catch {
    return null
  }
}

/**
 * Poll n8n for an OTP of `type` ('login_otp' | 'payment_otp').
 * Expiry is checked ENTIRELY in server time (response.timestamp vs response.expires_at)
 * so it is immune to clock skew between this machine and the n8n container. The n8n
 * 40s TTL is what prevents reusing a stale OTP (each step waits after triggering).
 */
async function serverNowMs() {
  const s = await getState()
  return s && s.timestamp ? new Date(s.timestamp).getTime() : null
}

// Report a completed purchase to the n8n ledger -> per-card milestone counters + voucher persistence.
async function reportTransaction(tx) {
  try {
    await axios.post(`${N8N_BASE_URL}${WEBHOOK_PATH}`, { type: 'transaction', ...tx }, { timeout: 8000 })
    log(`Reported to n8n ledger: ${tx.card} ₹${tx.value}${tx.voucher_code ? ' voucher ' + tx.voucher_code : ''}`)
  } catch (e) {
    log('Transaction report failed:', e.message)
  }
}

async function waitForOtp(type, { timeoutMs = 120000, sinceServer = null, ttlMs = 40000 } = {}) {
  const start = Date.now()
  log(`Waiting for ${type} from n8n…`)
  await sleep(2000)
  while (Date.now() - start < timeoutMs) {
    const s = await getState()
    if (s && s.success && s[type] && s.timestamp && s.expires_at) {
      const serverNow = new Date(s.timestamp).getTime()
      const expiry = new Date(s.expires_at).getTime()
      const createdAt = expiry - ttlMs
      const notExpired = serverNow < expiry
      const fresh = sinceServer == null || createdAt >= sinceServer - 3000 // created after we requested
      if (notExpired && fresh) { log(`Got ${type}: ${s[type]}`); return s[type] }
    } else if (s && s.success && s[type] && !s.expires_at) {
      log(`Got ${type}: ${s[type]}`); return s[type]
    }
    await sleep(3000)
  }
  throw new Error(`Timeout waiting for ${type} (${timeoutMs / 1000}s)`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Fill a one-time code into single-char boxes or a single input, across the page or a frame.
async function fillOtp(scope, code) {
  const boxes = scope.locator('input[type="password"], input[autocomplete="one-time-code"], input[inputmode="numeric"]')
  const n = await boxes.count().catch(() => 0)
  if (n >= code.length) {
    for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i])
  } else if (n === 1) {
    await boxes.first().fill(code)
  } else {
    await boxes.first().click().catch(() => {})
    await scope.page?.().keyboard?.type(code, { delay: 70 }).catch(() => {})
  }
}

// ============================ helpers ============================
function formatIndian(n) {
  const s = String(n)
  if (s.length <= 3) return s
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3)
}
async function isSessionExpired(page) {
  const t = (await page.locator('body').textContent({ timeout: 1500 }).catch(() => '')) || ''
  return /session expired/i.test(t)
}
// Find the payment-gateway iframe among the page's frames (Razorpay is the live gateway;
// keep the others as fallbacks in case the provider changes).
function payuFrame(page) {
  const f = page.frames().find((fr) => /razorpay|payu|plural|secure|3ds|acs|custcap/i.test(fr.url()))
  return f || null
}
// Find the frame that actually CONTAINS payment content (Razorpay nests into about:blank /
// child iframes), by scanning every frame's text — robust to which URL the content lives in.
async function findPayFrame(page) {
  const end = Date.now() + 30000
  const rx = /pay now|saved cards|card ending|no cvv|credit card|enter cvv|one[- ]?time password|otp/i
  while (Date.now() < end) {
    for (const fr of page.frames()) {
      const txt = (await fr.locator('body').innerText({ timeout: 700 }).catch(() => '')) || ''
      if (rx.test(txt)) return fr
    }
    await sleep(1000)
  }
  return null
}
// Dump every frame's URL + buttons + body snippet so gateway selectors can be hardened from logs.
async function dumpFrames(page) {
  for (const fr of page.frames()) {
    const u = fr.url().slice(0, 70)
    const btns = await fr.locator('button').allInnerTexts().catch(() => [])
    const body = ((await fr.locator('body').innerText({ timeout: 700 }).catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 220)
    log(`FRAME [${u}] buttons=${JSON.stringify(btns).slice(0, 200)} body="${body}"`)
  }
}
// Robust click: match button-by-role OR styled element by text, scroll in, force-fallback.
async function clickish(page, rx, timeout = 25000) {
  const loc = page.getByRole('button', { name: rx }).or(page.locator('button', { hasText: rx })).or(page.getByText(rx))
  await loc.first().waitFor({ state: 'visible', timeout })
  await loc.first().scrollIntoViewIfNeeded().catch(() => {})
  await loc.first().click({ timeout: 8000 }).catch(async () => { await loc.first().click({ force: true }) })
}

// ============================ flow steps ============================
async function login(page) {
  log('Login: navigating…')
  await page.goto(SHOPWISE_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const mobile = page.locator('input[type="tel"]')
  await mobile.waitFor({ state: 'visible', timeout: 30000 })
  await mobile.fill(MOBILE)
  const sinceServer = await serverNowMs() // baseline before requesting, so we only accept a fresh OTP
  await page.getByRole('button', { name: /Get OTP & Continue/i }).first().click()
  const otp = await waitForOtp('login_otp', { timeoutMs: 120000, sinceServer })
  await fillOtp(page, otp)
  await sleep(600)
  await page.getByRole('button', { name: /Validate and Login/i }).click()
  await page.waitForURL((u) => u.host.includes('giftstacc.com'), { timeout: 60000 })
  log('Login: success')
}

async function ensureLoggedIn(page) {
  await page.goto(`${SHOPWISE_BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  const loginBtn = page.getByRole('link', { name: /^Login$/i }).or(page.getByText(/^Login$/))
  if (await loginBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await login(page)
  }
}

async function selectDenominations(page, brandProductId, denominations) {
  const url = `${SHOPWISE_BASE_URL}/giftcard?productId=${encodeURIComponent(brandProductId)}`
  log(`Product: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(1500)
  if (await isSessionExpired(page)) { await login(page); await page.goto(url, { waitUntil: 'domcontentloaded' }); await sleep(1500) }

  // Wait for the denomination tiles ("Increase by one" steppers) to render before selecting.
  await page.getByRole('button', { name: /Increase by one/i }).first().waitFor({ state: 'visible', timeout: 25000 })
  const found = await page.getByRole('button', { name: /Increase by one/i }).count()
  log(`  denomination steppers loaded: ${found}`)

  for (const { amount, qty } of denominations) {
    const fmt = formatIndian(amount).replace(/,/g, '\\,') // e.g. 1\,000
    const price = `₹${formatIndian(amount)}`
    log(`  + ${qty} x ${price}`)
    // Find the concrete Increase stepper whose row contains exactly this comma price
    // (₹1,000 won't match ₹10,000 nor the ₹1000 badge). [1] = nearest ₹-ancestor = the row.
    const incs = await page.getByRole('button', { name: /Increase by one/i }).all()
    const re = new RegExp(`₹\\s*${fmt}(?!\\d)`)
    let target = null
    for (const b of incs) {
      const rt = ((await b.locator('xpath=ancestor::*[contains(.,"₹")][1]').first().textContent({ timeout: 1500 }).catch(() => '')) || '').replace(/\s+/g, ' ')
      if (re.test(rt)) { target = b; break }
    }
    if (!target) throw new Error(`Denomination ${price} not found for product`)
    for (let i = 0; i < qty; i++) {
      await target.scrollIntoViewIfNeeded().catch(() => {})
      await target.click({ timeout: 8000 }).catch(async () => { await target.click({ force: true }) })
      await sleep(500)
    }
  }
  await clickish(page, /^Continue$/i)
  await page.waitForLoadState('domcontentloaded')
  await sleep(2500)
  // On /card the order total reads ₹0 until each row's qty stepper ("+"/"-") is exercised
  // (the /giftcard pre-selection only populates the rows). Nudge +1 then −1 on every row to
  // commit the quantities, then confirm a non-zero total before paying.
  const plusBtns = await page.getByRole('button', { name: '+' }).all()
  for (const b of plusBtns) { await b.click().catch(() => {}); await sleep(350) }
  const minusBtns = await page.getByRole('button', { name: '-' }).all()
  for (const b of minusBtns) { await b.click().catch(() => {}); await sleep(350) }
  await page.screenshot({ path: 'shopwise-card-stage.png', fullPage: true }).catch(() => {})
  const buyNow = page.locator('button').filter({ hasText: /Buy now with/i }) // the actual button, not a text span
  await buyNow.first().waitFor({ state: 'visible', timeout: 30000 })
  let label = ''
  for (let i = 0; i < 12; i++) {
    label = ((await buyNow.first().textContent().catch(() => '')) || '').trim()
    if (/[1-9]/.test(label.replace(/buy now with/i, ''))) break
    await sleep(1000)
  }
  log(`Checkout total: "${label}"`)
  if (!/[1-9]/.test(label.replace(/buy now with/i, ''))) throw new Error('Checkout total is ₹0 after qty nudge — order not registered')
  return buyNow
}

// PayU saved-card payment + Amex SafeKey 3DS. Selectors are best-effort against the
// PayU/Plural iframe; verified visually but hardened on live runs. MANUAL_3DS pauses
// for a human to complete the SafeKey step (the fetched OTP is printed for them).
async function payWithSavedCard(page, cardIndex) {
  log(`Payment: opening gateway, target saved-card slot ${cardIndex}`)
  const sinceServer = await serverNowMs() // baseline before triggering pay, so SafeKey OTP must be fresh
  // Razorpay renders its card UI into a nested/about:blank iframe — find the frame that actually
  // contains payment content (not just the first razorpay-URL frame), and dump all frames for hardening.
  const frame = await findPayFrame(page)
  await dumpFrames(page)

  // Best-effort auto: select saved card + PAY NOW. Never throw — fall back to manual.
  if (frame && !MANUAL) {
    try {
      const savedCards = frame.getByText(/Credit Card\s*\*+\d+/i)
      await savedCards.first().waitFor({ state: 'visible', timeout: 12000 })
      const count = await savedCards.count()
      log(`PayU saved cards detected: ${count}`)
      await savedCards.nth(Math.min(cardIndex, count - 1)).click()
      await sleep(1800)
      // PAY NOW is in the SAME payment frame — never mix frame + page locators in .or()
      const payBtn = frame.getByRole('button', { name: /pay now/i }).or(frame.getByText(/^\s*pay now/i))
      await payBtn.first().waitFor({ state: 'visible', timeout: 8000 })
      await payBtn.first().click({ timeout: 6000 }).catch(async () => { await payBtn.first().click({ force: true }) })
      log('PayU: clicked saved card + PAY NOW')
    } catch (e) {
      log(`PayU auto-step incomplete (${e.message}). Please complete card selection + PAY NOW in the window.`)
    }
  } else {
    log('Complete the PayU step in the window: pick your card → PAY NOW → SafeKey.')
  }

  // SafeKey 3DS: fetch a FRESH payment OTP (created after we triggered pay).
  const otp = await waitForOtp('payment_otp', { timeoutMs: 240000, sinceServer }).catch((e) => { log(e.message); return null })
  if (otp) {
    log(`>>> SafeKey OTP: ${otp} <<<  (auto-filling; if it stalls, enter it manually)`)
    if (!MANUAL) await tryFill3ds(page, otp).catch(() => {})
  }

  // Success = redirect to the order confirmation page (whether script or human completed it).
  await page.waitForURL(/order-confirmation/i, { timeout: 240000 })
  log('Payment: order confirmed')
}

async function tryFill3ds(page, otp) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    // try "Go to payment page" if the processing screen is showing it
    for (const fr of [page, ...page.frames()]) {
      const link = fr.getByText?.(/go to payment page/i)
      if (link && (await link.first().isVisible({ timeout: 500 }).catch(() => false))) {
        await link.first().click().catch(() => {})
        await sleep(2000)
      }
    }
    // try to find an OTP field anywhere and fill it
    for (const fr of [page, ...page.frames()]) {
      const inp = fr.locator?.('input[type="password"], input[autocomplete="one-time-code"], input[name*="otp" i], input[inputmode="numeric"]')
      if (inp && (await inp.first().isVisible({ timeout: 500 }).catch(() => false))) {
        await fillOtp(fr, otp)
        const submit = fr.getByRole('button', { name: /submit|continue|verify|confirm|pay/i })
        if (await submit.first().isVisible({ timeout: 1000 }).catch(() => false)) await submit.first().click().catch(() => {})
        return true
      }
    }
    if (/order-confirmation/i.test(page.url())) return true
    await sleep(2500)
  }
  return false
}

async function captureVoucher(page) {
  // On /order-confirmation, "Get Code" reveals the voucher; also fall back to n8n.
  const out = { order: null, value: null, code: null, pin: null }
  out.order = (await page.getByText(/Order Number/i).locator('xpath=following::*[1]').textContent({ timeout: 3000 }).catch(() => null)) || null
  const getCode = page.getByRole('button', { name: /get code/i })
  if (await getCode.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await getCode.first().click().catch(() => {})
    await sleep(2500)
    const body = (await page.textContent('body').catch(() => '')) || ''
    const m = body.match(/\b(\d{12,19})\b/)
    if (m) out.code = m[1]
  }
  if (!out.code) {
    const s = await getState()
    if (s && s.voucher_code) { out.code = s.voucher_code; out.pin = s.voucher_pin }
  }
  return out
}

async function waitFor(fn, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(500) }
  return fn()
}

// ============================ one purchase ============================
async function buyVoucher(page, job, cardsMap, brandsMap, { dryRun = false } = {}) {
  const productId = brandsMap[job.brand]
  if (!productId) throw new Error(`Unknown brand "${job.brand}" — add its productId to the plan's brands{}`)
  const cardIndex = cardsMap[job.card]
  if (cardIndex == null) throw new Error(`Unknown card "${job.card}" — map it in the plan's cards{}`)
  const total = (job.denominations || []).reduce((s, d) => s + d.amount * d.qty, 0)

  await ensureLoggedIn(page)
  const buyNow = await selectDenominations(page, productId, job.denominations)
  if (dryRun) {
    await page.screenshot({ path: `shopwise-dryrun-${Date.now()}.png`, fullPage: true }).catch(() => {})
    log(`DRY-RUN: reached "Buy now" for ₹${total} on ${job.brand}/${job.card}. Not paying.`)
    return { ok: true, dryRun: true, total }
  }
  await buyNow.first().scrollIntoViewIfNeeded().catch(() => {})
  await buyNow.first().click({ timeout: 8000 }).catch(async () => { await buyNow.first().click({ force: true }) })
  await payWithSavedCard(page, cardIndex)
  const voucher = await captureVoucher(page)
  log(`Voucher: ${JSON.stringify(voucher)}`)
  await reportTransaction({ card: job.card, brand: job.brand, value: total, order: voucher.order, voucher_code: voucher.code, voucher_pin: voucher.pin })
  return { ok: true, total, voucher }
}

// ============================ plan runner ============================
async function runPlan(plan, { dryRun = false, only = null } = {}) {
  if (!MOBILE || !N8N_BASE_URL) throw new Error('Set MOBILE and N8N_BASE_URL in .env')
  const brandsMap = plan.brands || {}
  const cardsMap = plan.cards || {}
  let jobs = plan.jobs || []
  if (only != null) jobs = [jobs[only]].filter(Boolean)

  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--window-size=1920,1080'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'en-IN', timezoneId: process.env.TZ || 'Asia/Kolkata', ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const results = []
  try {
    await login(page)
    for (const job of jobs) {
      const reps = job.count || 1
      for (let r = 1; r <= reps; r++) {
        const label = `${job.name || job.brand} [${r}/${reps}]`
        log(`\n=== ${label} ===`)
        try {
          const res = await buyVoucher(page, job, cardsMap, brandsMap, { dryRun })
          results.push({ job: label, ...res })
        } catch (e) {
          log(`FAILED ${label}: ${e.message}`)
          await page.screenshot({ path: `shopwise-error-${Date.now()}.png`, fullPage: true }).catch(() => {})
          results.push({ job: label, ok: false, error: e.message })
        }
        await sleep(2000)
      }
    }
  } finally {
    await browser.close()
  }
  const ok = results.filter((r) => r.ok).length
  log(`\n=== SUMMARY: ${ok}/${results.length} succeeded ===`)
  results.forEach((r) => log(` - ${r.job}: ${r.ok ? (r.dryRun ? 'dry-run ok' : 'OK ' + (r.voucher?.code ? 'code=' + r.voucher.code : '')) : 'FAIL: ' + r.error}`))
  return results
}

// ============================ CLI / service ============================
function parseArgs(argv) {
  const a = { dryRun: false, only: null, plan: null, serve: false }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--serve') a.serve = true
    else if (argv[i] === '--plan') a.plan = argv[++i]
    else if (argv[i] === '--only') a.only = parseInt(argv[++i], 10)
  }
  return a
}

if (require.main === module) {
  const args = parseArgs(process.argv)
  if (args.serve) {
    const app = express()
    app.use(express.json())
    let running = false
    app.get('/health', (req, res) => res.json({ status: 'healthy', running }))
    app.post('/run', async (req, res) => {
      if (running) return res.status(409).json({ error: 'already running' })
      running = true
      try {
        const plan = req.body.plan || JSON.parse(fs.readFileSync(req.body.planFile, 'utf8'))
        const results = await runPlan(plan, { dryRun: !!req.body.dryRun, only: req.body.only ?? null })
        res.json({ ok: true, results })
      } catch (e) { res.status(500).json({ ok: false, error: e.message }) } finally { running = false }
    })
    app.listen(3000, () => log('ShopWise automation service on :3000  (POST /run {plan|planFile, dryRun, only})'))
  } else if (args.plan) {
    const plan = JSON.parse(fs.readFileSync(args.plan, 'utf8'))
    runPlan(plan, { dryRun: args.dryRun, only: args.only })
      .then(() => process.exit(0))
      .catch((e) => { log('Fatal:', e.message); process.exit(1) })
  } else {
    console.log('Usage: node shopwise_automate.js --plan <file.json> [--dry-run] [--only N] | --serve')
    process.exit(1)
  }
}

module.exports = { runPlan, buyVoucher, login, waitForOtp }
