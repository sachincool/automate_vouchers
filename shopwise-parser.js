// ===========================================
// SHOPWISE OTP + VOUCHER PARSER & MILESTONE LEDGER  (n8n Code node)
// ===========================================
// Drop-in for the "OTP/Voucher Parser & Storage" code node. Handles:
//   • login_otp / mobile_otp / payment_otp  — short-lived (40s TTL), for the automation to poll
//   • voucher delivery SMS                  — PERSISTED forever (TTL bug fixed) in a ledger
//   • transaction events from the automation — per-card MILESTONE COUNTERS
//
// TWO storage areas in workflow static data:
//   $getWorkflowStaticData('global').voucher_automation  -> OTPs, 40s TTL (cleared on expiry)
//   $getWorkflowStaticData('global').shopwise_ledger      -> { vouchers:[], transactions:[], counters:{} }  NEVER expires
//
// Respond-to-Webhook node should also expose the ledger, e.g.:
//   login_otp: ...current_globals.login_otp,
//   vouchers:  $node["OTP/Voucher Parser & Storage"].json.ledger.vouchers,
//   counters:  $node["OTP/Voucher Parser & Storage"].json.ledger.counters,
//
// The automation reports a completed purchase by POSTing:
//   { "type":"transaction", "card":"mrcc", "brand":"amazonpay", "value":1500, "order":"A0H..", "voucher_code":"..", "voucher_pin":".." }

const GLOBAL_TTL_SECONDS = 40

// ---------- utils ----------
const now = () => new Date().toISOString()
const addSecs = (d, s) => new Date(new Date(d).getTime() + s * 1000).toISOString()
const before = (a, b) => new Date(a) < new Date(b)

function emptyOtp() {
  return { login_otp: null, mobile_otp: null, payment_otp: null, voucher_code: null, voucher_pin: null, voucher_value: null, last_updated: null, expires_at: null }
}
function getOtp() { return $getWorkflowStaticData('global').voucher_automation || emptyOtp() }
function saveOtp(key, value) {
  const s = getOtp(); s[key] = value; s.last_updated = now(); s.expires_at = addSecs(now(), GLOBAL_TTL_SECONDS)
  $getWorkflowStaticData('global').voucher_automation = s
  return { success: true, stored: key, value, expires_at: s.expires_at }
}
function otpValid() { const s = getOtp(); return s.expires_at ? before(now(), s.expires_at) : false }
function clearExpiredOtp() { if (!otpValid()) { $getWorkflowStaticData('global').voucher_automation = emptyOtp(); return { cleared: true } } return { cleared: false } }

// ---------- persistent ledger (vouchers + transactions + milestone counters) ----------
function getLedger() {
  return $getWorkflowStaticData('global').shopwise_ledger || { vouchers: [], transactions: [], counters: {} }
}
function saveLedger(l) { $getWorkflowStaticData('global').shopwise_ledger = l }

function addVoucher(v) {
  const l = getLedger()
  if (!l.vouchers.some((x) => x.code === v.code)) { l.vouchers.unshift(v); l.vouchers = l.vouchers.slice(0, 500) }
  saveLedger(l)
  return l
}
function addTransaction(tx) {
  const l = getLedger()
  const rec = { ...tx, ts: now() }
  l.transactions.unshift(rec); l.transactions = l.transactions.slice(0, 2000)
  const card = tx.card || 'unknown'
  const c = l.counters[card] || { count: 0, total_value: 0 }
  c.count += 1
  c.total_value += Number(tx.value) || 0
  l.counters[card] = c
  saveLedger(l)
  return l
}

// ---------- parsers ----------
function parseLoginOTP(c) {
  for (const p of [/(\d{4,6})\s+is\s+your\s+ShopWise\s+login\s+OTP/i, /login\s+OTP[:\s]+(\d{4,6})/i, /(\d{4,6})\s+is\s+your\s+(?:login|verification)\s+OTP/i, /\b(\d{4})\b/]) {
    const m = c.match(p); if (m) return { success: true, otp: m[1], type: 'login_otp' }
  }
  return { success: false, type: 'login_otp', error: 'no login OTP' }
}
function parseMobileOTP(c) {
  for (const p of [/(?:OTP|otp)\s*:?\s*(\d{4,8})/i, /(\d{4,8})\s*(?:is\s*your|your)\s*(?:OTP|verification|code)/i, /(?:code|OTP)\s*(\d{4,8})/i, /\b(\d{6})\b/]) {
    const m = c.match(p); if (m && m[1].length >= 4 && m[1].length <= 8) return { success: true, otp: m[1], type: 'mobile_otp' }
  }
  return { success: false, type: 'mobile_otp', error: 'no mobile OTP' }
}
function parsePaymentOTP(c) {
  for (const p of [/SafeKey\s+One-Time\s+Password\s+for\s+INR\s+[\d.,]+,?\s*at\s+.+?\s+is\s*(\d{4,8})/i, /(?:safekey|safe\s*key).*?\bis\s*(\d{4,8})\b/i, /(?:OTP|otp).*?(?:for|to).*?(?:inr|usd|rs).*?(?:is\s*)?(\d{4,8})/i, /\b(\d{6})\b/]) {
    const m = c.match(p); if (m && m[1].length >= 4 && m[1].length <= 8) return { success: true, otp: m[1], type: 'payment_otp' }
  }
  return { success: false, type: 'payment_otp', error: 'no payment OTP' }
}
function parseVoucher(c) {
  const code = (c.match(/Voucher\s*Details\s*:?\s*([A-Z0-9]{6,20})/i) || c.match(/(?:voucher|gift\s*card|code)\s*:?\s*([A-Z0-9]{8,16})/i) || [])[1] || null
  const pin = (c.match(/Additional\s*Details\s*:?\s*([A-Z0-9]{4,20})/i) || c.match(/PIN\s*:?\s*([A-Z0-9]{4,8})/i) || [])[1] || null
  const value = (c.match(/Value\s*:?\s*(\d{2,7})/i) || [])[1] || null
  const validity = (c.match(/Valid\s*till\s*([\d-]+)/i) || [])[1] || null
  const brand = (c.match(/your\s+(.+?)\s+E-?Gift\s+Voucher/i) || [])[1] || null
  if (code && pin) return { success: true, voucher_code: code, voucher_pin: pin, voucher_value: value, validity, brand, type: 'voucher_data' }
  if (code || pin) return { success: false, partial: true, voucher_code: code, voucher_pin: pin, type: 'voucher_data', error: 'incomplete' }
  return { success: false, type: 'voucher_data', error: 'no voucher' }
}

// ---------- routing ----------
function contentType(c) {
  const x = c.toLowerCase()
  if (c === '__GET_STATE__' || c === '__HEALTH_CHECK__') return 'status_check'
  if (x.includes('login otp') || (x.includes('shopwise') && x.includes('otp') && x.includes('login'))) return 'login_otp'
  if (x.includes('safekey') || x.includes('safe key') || (x.includes('otp') && (x.includes('card ending') || x.includes('inr') || x.includes('usd'))) || x.includes('one-time password') || x.includes('payment') || x.includes('transaction') || x.includes('bank')) return 'payment_otp'
  if (x.includes('voucher details') || x.includes('e-gift voucher') || (x.includes('voucher') && (x.includes('code') || x.includes('pin') || x.includes('is here'))) || x.includes('gift card')) return 'voucher'
  return 'mobile_otp'
}

function ledgerSummary() {
  const l = getLedger()
  return { vouchers: l.vouchers.slice(0, 50), counters: l.counters, transaction_count: l.transactions.length, voucher_count: l.vouchers.length }
}

// ---------- main ----------
try {
  const d = $input.all()[0].json
  const body = (d.body && typeof d.body === 'object') ? d.body : d

  // 1) Transaction event from the automation -> milestone counters (no SMS parsing)
  if (body && body.type === 'transaction') {
    const l = addTransaction({ card: body.card, brand: body.brand, value: body.value, order: body.order })
    // A single order can yield multiple vouchers (e.g. 1000+500 = two codes). Persist each.
    const vs = Array.isArray(body.vouchers) ? body.vouchers : (body.voucher_code ? [{ code: body.voucher_code, pin: body.voucher_pin }] : [])
    for (const v of vs) if (v && v.code) addVoucher({ code: v.code, pin: v.pin || null, value: v.value || null, brand: body.brand, source: 'automation', ts: now() })
    return [{ json: { success: true, content_type: 'transaction', current_globals: getOtp(), ledger: ledgerSummary(), counters: l.counters, timestamp: now(), message: `Recorded transaction for ${body.card} (${vs.length} vouchers)` } }]
  }

  // Reset the milestone ledger (clears vouchers/transactions/counters) — POST {"type":"reset_ledger"}
  if (body && body.type === 'reset_ledger') {
    saveLedger({ vouchers: [], transactions: [], counters: {} })
    return [{ json: { success: true, content_type: 'reset', current_globals: getOtp(), ledger: ledgerSummary(), timestamp: now(), message: 'Ledger reset' } }]
  }

  clearExpiredOtp()

  // extract SMS content
  let content = ''
  if (body && body.message) content = body.message
  else if (body && body.text) content = body.text
  else if (d.message) content = d.message
  else if (d.text) content = d.text
  else if (d.content) content = d.content
  else content = JSON.stringify(d)

  const ct = contentType(content)

  if (ct === 'status_check') {
    const g = getOtp()
    return [{ json: { success: true, content_type: 'status_check', current_globals: g, ledger: ledgerSummary(), data_validity: { is_valid: otpValid(), expires_at: g.expires_at }, timestamp: now(), message: 'Status check successful' } }]
  }

  let parse, storage
  switch (ct) {
    case 'login_otp': parse = parseLoginOTP(content); if (parse.success) storage = saveOtp('login_otp', parse.otp); break
    case 'mobile_otp': parse = parseMobileOTP(content); if (parse.success) storage = saveOtp('mobile_otp', parse.otp); break
    case 'payment_otp': parse = parsePaymentOTP(content); if (parse.success) storage = saveOtp('payment_otp', parse.otp); break
    case 'voucher':
      parse = parseVoucher(content)
      if (parse.success) {
        saveOtp('voucher_code', parse.voucher_code); saveOtp('voucher_pin', parse.voucher_pin)
        addVoucher({ code: parse.voucher_code, pin: parse.voucher_pin, value: parse.voucher_value, validity: parse.validity, brand: parse.brand, source: 'sms', ts: now() }) // PERSIST (no TTL)
        storage = { persisted: true }
      }
      break
    default: parse = { success: false, error: 'unknown' }
  }

  const g = getOtp()
  return [{ json: { success: parse.success, content_type: ct, parse_result: parse, storage_result: storage, current_globals: g, ledger: ledgerSummary(), data_validity: { is_valid: otpValid(), expires_at: g.expires_at }, timestamp: now(), message: parse.success ? `Successfully got ${ct}` : `Failed to process ${ct}: ${parse.error}` } }]
} catch (error) {
  return [{ json: { success: false, error: error.message, stack: error.stack, timestamp: now(), message: 'Internal parser error' } }]
}
