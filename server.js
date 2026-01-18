const express = require('express')
const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const axios = require('axios')
const dotenv = require('dotenv')

dotenv.config()

// Add stealth plugin to avoid bot detection
chromium.use(StealthPlugin())

const app = express()
app.use(express.json())

const {
  MOBILE,
  EMAIL,
  MEMBERSHIP_CARD_CVV,
  GOLDCHARGE_CARD_CVV,
  USE_GOLDCHARGE_CARD,
  N8N_BASE_URL,
  WEBHOOK_PATH = '/webhook/ios-sms',
} = process.env

// DEBUG: Log env vars at startup
console.log('=== ENV DEBUG ===')
console.log(`USE_GOLDCHARGE_CARD env var raw value: "${USE_GOLDCHARGE_CARD}"`)
console.log(`USE_GOLDCHARGE_CARD env var type: ${typeof USE_GOLDCHARGE_CARD}`)
console.log(`USE_GOLDCHARGE_CARD parsed as boolean: ${String(USE_GOLDCHARGE_CARD).toLowerCase() === 'true'}`)
console.log('=================')


const POLLING_INTERVAL = 5000 // Increased to 5 seconds for better reliability
const MAX_RETRIES = 5 // Increased to 5 retries (25 seconds total)
const INITIAL_WAIT = 2000 // Initial wait before first check

async function getGlobalState() {
  try {
    const response = await axios.post(
      `${N8N_BASE_URL}${WEBHOOK_PATH}`,
      {
        message: '__GET_STATE__',
        type: 'status_check',
      },
      { timeout: 5000 }
    )
    return response.data
  } catch {
    return null
  }
}

async function getOTPFromWebhook(otpType, timeoutMs = 120000) {
  const startTime = Date.now()
  let retryCount = 0

  console.log(`Waiting for ${otpType} from webhook...`)

  // Initial wait before first check
  console.log(`Initial wait of ${INITIAL_WAIT}ms before first check...`)
  await new Promise((res) => setTimeout(res, INITIAL_WAIT))

  while (Date.now() - startTime < timeoutMs) {
    console.log(
      `Checking for ${otpType} (attempt ${retryCount + 1}/${MAX_RETRIES})...`
    )
    const state = await getGlobalState()

    if (state && state.success) {
      const otpValue = state[otpType]
      if (otpValue) {
        console.log(`${otpType} found!`)
        if (state.expires_at) {
          if (new Date() < new Date(state.expires_at)) {
            console.log(`${otpType} is still valid, returning...`)
            return otpValue
          } else {
            console.log(`${otpType} has expired, continuing...`)
          }
        } else {
          console.log(`${otpType} has no expiry, returning...`)
          return otpValue
        }
      } else {
        console.log(`No ${otpType} found in state`)
      }
    } else {
      console.log(`No valid state received from webhook`)
    }

    // Sleep before next attempt
    console.log(
      `Attempt ${
        retryCount + 1
      }/${MAX_RETRIES}: No ${otpType} found, waiting ${POLLING_INTERVAL}ms...`
    )
    await new Promise((res) => setTimeout(res, POLLING_INTERVAL))

    retryCount++
    if (retryCount >= MAX_RETRIES) {
      throw new Error(
        `Failed to retrieve ${otpType} after ${MAX_RETRIES} retries (${
          (MAX_RETRIES * POLLING_INTERVAL) / 1000
        }s total)`
      )
    }
  }

  throw new Error(`Timeout waiting for ${otpType} after ${timeoutMs / 1000}s`)
}

async function runAutomation(options = {}) {
  // DEBUG: Log incoming options
  console.log('=== runAutomation DEBUG ===')
  console.log(`options received:`, JSON.stringify(options))
  console.log(`options.goldCharge type: ${typeof options.goldCharge}`)
  console.log(`options.goldCharge value: ${options.goldCharge}`)
  
  const goldCharge =
    typeof options.goldCharge === 'boolean'
      ? options.goldCharge
      : String(USE_GOLDCHARGE_CARD).toLowerCase() === 'true'
  
  console.log(`RESOLVED goldCharge: ${goldCharge}`)
  console.log(`*** CARD SELECTION: ${goldCharge ? 'GOLDCHARGE CARD (id: 1000105, ADD btn index: 2)' : 'MEMBERSHIP CARD (id: 1000075, ADD btn index: 3)'} ***`)
  console.log('===========================')
  
  if (!MOBILE || !EMAIL || !MEMBERSHIP_CARD_CVV || !N8N_BASE_URL) {
    throw new Error('MOBILE, EMAIL, MEMBERSHIP_CARD_CVV, N8N_BASE_URL must be set in env')
  }
  if (goldCharge) {
    console.log('*** USING GOLDCHARGE CARD ***')
  } else {
    console.log('*** USING MEMBERSHIP CARD ***')
  }
  console.log('Starting Playwright automation...')

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      // Stealth mode args
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--start-maximized',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: process.env.TZ || 'Asia/Kolkata',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  })

  const page = await context.newPage()

  try {
    console.log('Navigating to Gyftr page...')
    const targetUrl =
      'https://www.gyftr.com/amexrewardmultiplier/swiggy-gv-gift-vouchers'
    // Block telemetry/analytics that may hold the network idle state
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (
        /google-analytics|analytics\.google|googletagmanager|google\.com\/ccm\/collect|doubleclick\.net|hotjar|youtube\.com\/embed/i.test(
          url
        )
      ) {
        return route.abort()
      }
      return route.continue()
    })

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })

    console.log('Waiting for page to load completely...')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Additional wait for dynamic content

    // Select ADD button by price instead of index
    const targetAmount = goldCharge ? '1,000' : '1,500'
    const targetAmountAlt = goldCharge ? '1000' : '1500' // Without comma
    console.log(`Looking for ADD button with price ₹${targetAmount}...`)
    
    let addButtonClicked = false
    
    // Strategy 1: Find card/container with the price and click its ADD button
    const pricePatterns = [
      `₹${targetAmount}`,
      `₹ ${targetAmount}`,
      `Rs.${targetAmount}`,
      `Rs. ${targetAmount}`,
      `₹${targetAmountAlt}`,
      `Rs.${targetAmountAlt}`,
    ]
    
    for (const priceText of pricePatterns) {
      if (addButtonClicked) break
      try {
        // Find elements containing the price text
        const priceElements = await page.locator(`text="${priceText}"`).all()
        console.log(`Found ${priceElements.length} elements with "${priceText}"`)
        
        for (const priceEl of priceElements) {
          if (addButtonClicked) break
          try {
            // Look for ADD button in the same parent container
            const container = priceEl.locator('xpath=ancestor::div[.//button[contains(text(), "ADD") or contains(text(), "Add")]]').first()
            const addBtn = container.getByRole('button', { name: 'ADD' })
            
            if (await addBtn.isVisible({ timeout: 1000 })) {
              await addBtn.click()
              console.log(`✓ Clicked ADD button for ${priceText}`)
              addButtonClicked = true
              break
            }
          } catch (e) {
            // Try next price element
          }
        }
      } catch (e) {
        console.log(`Price pattern "${priceText}" not found, trying next...`)
      }
    }
    
    // Strategy 2: Fallback - find ADD button that has the price nearby (sibling/adjacent)
    if (!addButtonClicked) {
      console.log('Trying fallback: checking text near each ADD button...')
      const allAddButtons = await page.getByRole('button', { name: 'ADD' }).all()
      console.log(`Found ${allAddButtons.length} ADD buttons total`)
      
      for (let i = 0; i < allAddButtons.length; i++) {
        const btn = allAddButtons[i]
        try {
          // Get the parent card/container and check its text content
          const parentText = await btn.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or contains(@class, "product") or position() <= 5]').first().textContent()
          console.log(`ADD button ${i} parent text: ${parentText?.substring(0, 100)}...`)
          
          const hasTargetPrice = pricePatterns.some(p => parentText?.includes(p))
          if (hasTargetPrice) {
            await btn.click()
            console.log(`✓ Clicked ADD button ${i} (found price ${targetAmount} in parent)`)
            addButtonClicked = true
            break
          }
        } catch (e) {
          // Continue to next button
        }
      }
    }
    
    // Strategy 3: Last resort - use index (with warning)
    if (!addButtonClicked) {
      console.log('⚠ WARNING: Could not find ADD button by price, falling back to index!')
      const addButtons = await page.getByRole('button', { name: 'ADD' }).all()
      if (addButtons.length >= 4) {
        const idx = goldCharge ? 1 : 2  // Button 0=250, 1=1000, 2=1500, 3=2000
        console.log(`Falling back to index ${idx}`)
        await addButtons[idx].click()
        addButtonClicked = true
      } else if (addButtons.length > 0) {
        console.log('Falling back to first ADD button')
        await addButtons[0].click()
        addButtonClicked = true
      }
    }
    
    if (!addButtonClicked) {
      throw new Error(`Could not find ADD button for amount ₹${targetAmount}`)
    }

    console.log('Clicking View Cart...')
    await page.getByRole('link', { name: 'View Cart' }).click()
    await page.waitForLoadState('networkidle')

    console.log('Clicking PAY NOW...')
    await page.getByRole('button', { name: 'PAY NOW' }).click()
    await page.waitForLoadState('networkidle')

    console.log('Filling mobile number...')
    await page.getByRole('textbox', { name: 'Enter Mobile' }).fill(MOBILE)

    console.log('Filling email...')
    await page.getByRole('textbox', { name: 'Enter Email' }).fill(EMAIL)

    console.log('Clicking Get OTP...')
    await page.getByRole('button', { name: 'Get OTP' }).click()
    await page.waitForLoadState('networkidle')

    // Additional wait after requesting OTP
    console.log('Waiting 3 seconds after requesting mobile OTP...')
    await page.waitForTimeout(3000)

    const mobileOtp = await getOTPFromWebhook('mobile_otp', 120000)
    console.log('Filling mobile OTP...')
    await page.getByRole('textbox', { name: 'Enter OTP' }).fill(mobileOtp)

    // Wait before submitting OTP
    console.log('Waiting 2 seconds before submitting mobile OTP...')
    await page.waitForTimeout(2000)

    await page.getByRole('button', { name: 'Submit' }).click()
    await page.waitForLoadState('networkidle')

    // Commented out "No thanks" button check - not appearing in headless mode
    /*
    console.log('Looking for No thanks button...')
    // Try multiple strategies to find the "No thanks" button
    try {
      await page.getByRole('button', { name: 'No thanks' }).click({ timeout: 10000 })
    } catch (error) {
      console.log('No thanks button not found with role, trying alternative selectors...')
      // Try alternative selectors
      const noThanksSelectors = [
        'button:has-text("No thanks")',
        '[data-testid*="no-thanks"]',
        '.no-thanks-btn',
        'button[class*="no"]',
        'a:has-text("No thanks")'
      ]
      
      let clicked = false
      for (const selector of noThanksSelectors) {
        try {
          const element = await page.locator(selector).first()
          if (await element.isVisible()) {
            await element.click()
            clicked = true
            console.log(`Clicked No thanks using selector: ${selector}`)
            break
          }
        } catch (e) {
          continue
        }
      }
      
      if (!clicked) {
        console.log('No thanks button not found, proceeding without it...')
      }
    }
    */

    console.log('Clicking Pay Now...')
    await page.getByRole('button', { name: 'Pay Now' }).click()
    await page.waitForLoadState('networkidle')

    console.log('Selecting card...')
    if (goldCharge) {
      console.log('Choosing GOLDCHARGE_CARD (id 1000105)')
      await page.locator('[id="1000105"]').click()
    } else {
      console.log('Choosing MEMBERSHIP_CARD (id 1000075)')
      await page.locator('[id="1000075"]').click()
    }

    console.log('Filling CVV...')
    if (goldCharge) {
      await page.getByRole('textbox', { name: 'C V V' }).fill(GOLDCHARGE_CARD_CVV)
    } else {
      await page.getByRole('textbox', { name: 'C V V' }).fill(MEMBERSHIP_CARD_CVV)
    }

    console.log('Clicking Proceed to Pay...')
    await page.getByText('Proceed to Pay').click()
    await page.waitForLoadState('networkidle')

    // Additional wait after proceeding to payment
    console.log('Waiting 3 seconds after proceeding to payment...')
    await page.waitForTimeout(3000)

    const paymentOtp = await getOTPFromWebhook('payment_otp', 180000)
    console.log('Filling payment OTP...')
    await page
      .getByRole('textbox', { name: 'To Verify this transaction' })
      .fill(paymentOtp)

    // Wait before submitting payment OTP
    console.log('Waiting 2 seconds before submitting payment OTP...')
    await page.waitForTimeout(2000)

    await page.getByRole('button', { name: 'Continue' }).click()

    // Wait for SafeKey verification to complete
    console.log('Waiting for SafeKey verification to complete...')

    // Wait for either redirect back to Gyftr or SafeKey completion
    let redirectDetected = false
    let maxWaitTime = 120000 // 2 minutes max wait
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const currentUrl = page.url()
      console.log(`Current URL: ${currentUrl}`)

      // Check if we've been redirected back to Gyftr
      if (currentUrl.includes('gyftr.com') && !currentUrl.includes('safekey')) {
        console.log('Redirected back to Gyftr detected!')
        redirectDetected = true
        break
      }

      // Check if SafeKey is still loading
      try {
        const loadingSpinner = await page
          .locator('[class*="spinner"], [class*="loading"], .spinner, .loading')
          .first()
        if (await loadingSpinner.isVisible()) {
          console.log('SafeKey still loading, waiting...')
          await page.waitForTimeout(5000) // Wait 5 seconds before checking again
          continue
        }
      } catch (e) {
        // No loading spinner found, might be completed
        console.log('No loading spinner detected, checking for completion...')
      }

      // Check for SafeKey completion indicators
      try {
        const completionIndicators = [
          'verification complete',
          'authentication successful',
          'redirecting',
          'processing complete',
        ]

        const pageText = await page.textContent('body')
        let completionFound = false

        for (const indicator of completionIndicators) {
          if (pageText.toLowerCase().includes(indicator.toLowerCase())) {
            console.log(`SafeKey completion indicator found: "${indicator}"`)
            completionFound = true
            break
          }
        }

        if (completionFound) {
          console.log(
            'SafeKey appears to be completed, waiting for redirect...'
          )
          await page.waitForTimeout(10000) // Wait for redirect
          break
        }
      } catch (e) {
        console.log('Error checking completion indicators:', e.message)
      }

      await page.waitForTimeout(3000) // Wait before next check
    }

    if (!redirectDetected) {
      console.log(
        'SafeKey verification timeout, taking screenshot for debugging...'
      )
      await page.screenshot({ path: 'safekey-timeout.png', fullPage: true })
      throw new Error(
        'SafeKey verification did not complete within timeout period'
      )
    }

    // Wait for the final page to load after redirect
    console.log('Waiting for final page to load after redirect...')
    await page.waitForLoadState('networkidle', { timeout: 60000 })
    await page.waitForTimeout(5000) // Additional wait for dynamic content

    // Verify success by checking for success indicators
    console.log('Verifying transaction success...')

    const successIndicators = [
      'success',
      'congratulations',
      'thank you',
      'order confirmed',
      'payment successful',
      'voucher sent',
      'transaction successful',
      'order placed',
      'payment completed',
      'voucher purchased',
      'gift card sent',
      'order successful',
    ]

    let successFound = false
    const pageContent = await page.content()
    const pageText = await page.textContent('body')

    console.log('Current page URL after redirect:', page.url())
    console.log('Page content preview:', pageText.substring(0, 1000) + '...')

    // Check for success indicators in page content
    for (const indicator of successIndicators) {
      if (pageText.toLowerCase().includes(indicator.toLowerCase())) {
        console.log(`Success indicator found: "${indicator}"`)
        successFound = true
        break
      }
    }

    // Also check for common success elements
    const successSelectors = [
      '[class*="success"]',
      '[class*="congratulations"]',
      '[class*="thank"]',
      '[id*="success"]',
      '[data-testid*="success"]',
      '.success-message',
      '.order-confirmation',
      '.payment-success',
      '.voucher-success',
      '.gift-card-success',
    ]

    for (const selector of successSelectors) {
      try {
        const element = await page.locator(selector).first()
        if (await element.isVisible()) {
          console.log(`Success element found with selector: ${selector}`)
          successFound = true
          break
        }
      } catch (e) {
        continue
      }
    }

    // Check for specific success patterns in the main content area
    try {
      // Look for congratulations in the main content area specifically
      const mainContent = await page
        .locator('main, .main-content, .content, [role="main"]')
        .first()
      if (await mainContent.isVisible()) {
        const mainText = await mainContent.textContent()
        if (mainText.toLowerCase().includes('congratulations')) {
          console.log('CONGRATULATIONS found in main content area!')
          successFound = true
        }
      }
    } catch (e) {
      console.log('Could not check main content area:', e.message)
    }

    // Check for error indicators - but be more specific to avoid false positives
    const errorIndicators = [
      'transaction failed',
      'payment failed',
      'order failed',
      'authentication failed',
      'verification failed',
      'declined',
      'insufficient funds',
      'card declined',
      'payment declined',
    ]

    let errorFound = false
    let errorContext = ''

    for (const indicator of errorIndicators) {
      if (pageText.toLowerCase().includes(indicator.toLowerCase())) {
        // Get context around the error indicator to verify it's relevant
        const index = pageText.toLowerCase().indexOf(indicator.toLowerCase())
        const context = pageText.substring(
          Math.max(0, index - 50),
          index + indicator.length + 50
        )
        console.log(`Error indicator found: "${indicator}"`)
        console.log(`Error context: "${context}"`)
        errorFound = true
        errorContext = context
        break
      }
    }

    // Take a screenshot for verification
    await page.screenshot({ path: 'final-result.png', fullPage: true })
    console.log('Final page screenshot saved as final-result.png')

    // Prioritize success over error if both are found
    if (successFound && errorFound) {
      console.log(
        'Both success and error indicators found. Prioritizing success based on CONGRATULATIONS message.'
      )
      errorFound = false // Override error detection if success is also found
    }

    if (errorFound) {
      console.log('Error context:', errorContext)
      throw new Error(
        'Transaction appears to have failed based on page content'
      )
    }

    if (!successFound) {
      console.log(
        'Warning: No clear success indicators found, but proceeding...'
      )
      console.log('Page content preview:', pageText.substring(0, 500) + '...')
    } else {
      console.log('Success indicators confirmed!')
    }

    console.log('Automation completed successfully!')
  } catch (error) {
    console.error('Error during automation:', error.message)
    // Take a screenshot for debugging
    try {
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true })
    } catch {}
    throw error
  } finally {
    await browser.close()
  }
}

let isRunning = false

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'playwright-automation',
    isRunning: isRunning,
    timestamp: new Date().toISOString()
  })
})

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    service: 'Playwright Automation Service',
    status: isRunning ? 'running' : 'idle',
    isRunning: isRunning,
    timestamp: new Date().toISOString()
  })
})

app.post('/start', async (req, res) => {
  console.log('=== /start ENDPOINT DEBUG ===')
  console.log(`Request body:`, JSON.stringify(req.body))
  console.log(`req.body.goldCharge: ${req.body?.goldCharge} (type: ${typeof req.body?.goldCharge})`)
  
  if (isRunning) {
    return res
      .status(409)
      .json({ success: false, message: 'Automation already running' })
  }
  isRunning = true
  const goldChargeFlag =
    typeof req.body?.goldCharge === 'boolean'
      ? req.body.goldCharge
      : String(req.body?.goldCharge || '').toLowerCase() === 'true'
  
  console.log(`goldChargeFlag resolved to: ${goldChargeFlag}`)
  console.log(`*** WILL USE: ${goldChargeFlag ? 'GOLDCHARGE CARD' : 'MEMBERSHIP CARD'} ***`)
  console.log('=============================')
  
  try {
    await runAutomation({ goldCharge: goldChargeFlag })
    res.json({ success: true, message: 'Automation completed successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: error.message })
  } finally {
    isRunning = false
  }
})

app.listen(3000, () => console.log('Playwright Service running on port 3000'))
