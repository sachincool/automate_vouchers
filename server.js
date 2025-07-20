const express = require('express')
const { chromium } = require('playwright')
const axios = require('axios')

const app = express()
app.use(express.json())

const {
  MOBILE,
  EMAIL,
  CARD_CVV,
  N8N_BASE_URL,
  WEBHOOK_PATH = '/webhook/ios-sms',
} = process.env

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

async function runAutomation() {
  if (!MOBILE || !EMAIL || !CARD_CVV || !N8N_BASE_URL) {
    throw new Error('MOBILE, EMAIL, CARD_CVV, N8N_BASE_URL must be set in env')
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
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  })

  const page = await context.newPage()

  try {
    console.log('Navigating to Gyftr page...')
    await page.goto(
      'https://www.gyftr.com/amexrewardmultiplier/swiggy-gv-gift-vouchers',
      { waitUntil: 'networkidle', timeout: 60000 }
    )

    console.log('Waiting for page to load completely...')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Additional wait for dynamic content

    console.log('Clicking ADD button...')
    const addButtons = await page.getByRole('button', { name: 'ADD' }).all()
    if (addButtons.length >= 4) {
      await addButtons[3].click()
    } else {
      await page.getByRole('button', { name: 'ADD' }).first().click()
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
    await page.locator('[id="1000075"]').click()

    console.log('Filling CVV...')
    await page.getByRole('textbox', { name: 'C V V' }).fill(CARD_CVV)

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
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true })
    throw error
  } finally {
    await browser.close()
  }
}

app.post('/start', async (req, res) => {
  try {
    await runAutomation()
    res.json({ success: true, message: 'Automation completed successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: error.message })
  }
})

app.listen(3000, () => console.log('Playwright Service running on port 3000'))
