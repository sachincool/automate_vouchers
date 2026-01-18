const { chromium } = require('playwright')
const axios = require('axios')
require('dotenv').config()

// ===========================================
// CONFIGURATION
// ===========================================

// Read environment variables
const MOBILE = process.env.MOBILE
const EMAIL = process.env.EMAIL
const MEMBERSHIP_CARD_CVV = process.env.MEMBERSHIP_CARD_CVV
const GOLDCHARGE_CARD_CVV = process.env.GOLDCHARGE_CARD_CVV
const USE_GOLDCHARGE_CARD = String(process.env.USE_GOLDCHARGE_CARD || '').toLowerCase() === 'true'
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678'
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook/ios-sms'

// DEBUG: Log card selection at startup
console.log('=== CARD CONFIGURATION ===')
console.log(`USE_GOLDCHARGE_CARD: ${USE_GOLDCHARGE_CARD}`)
console.log(`*** WILL USE: ${USE_GOLDCHARGE_CARD ? 'GOLDCHARGE CARD (₹1,000)' : 'MEMBERSHIP CARD (₹1,500)'} ***`)
console.log('==========================\n')

if (!MOBILE || !EMAIL || !MEMBERSHIP_CARD_CVV) {
  console.error(
    '❌ Please set MOBILE, EMAIL, and MEMBERSHIP_CARD_CVV in your environment variables.'
  )
  process.exit(1)
}

// ===========================================
// WEBHOOK HELPER FUNCTIONS
// ===========================================

const POLLING_INTERVAL = 3000 // 3 seconds
const MAX_RETRIES = 3

/**
 * Get current global state from n8n webhook
 */
async function getGlobalState() {
  try {
    const response = await axios.post(
      `${N8N_BASE_URL}${WEBHOOK_PATH}`,
      {
        message: '__GET_STATE__',
        type: 'status_check',
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'playwright-automation/1.0',
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('❌ Failed to get global state:', error)
    return null
  }
}

/**
 * Wait for OTP to be available in global storage
 */
async function getOTPFromWebhook(otpType, timeoutMs = 120000) {
  const startTime = Date.now()
  let retryCount = 0

  console.log(
    `🔍 Waiting for ${otpType} from webhook (timeout: ${timeoutMs}ms)...`
  )
  console.log(
    `📱 Please send your ${otpType.replace(
      '_',
      ' '
    )} to the webhook when you receive it.`
  )

  while (Date.now() - startTime < timeoutMs) {
    try {
      const state = await getGlobalState()

      if (state && state.success) {
        // Get the OTP value directly from the response (webhook returns flat structure)
        const otpValue = state[otpType]

        if (otpValue) {
          // Check if data is still valid (not expired)
          if (state.expires_at) {
            const expiresAt = new Date(state.expires_at)
            const now = new Date()

            if (now < expiresAt) {
              console.log(`✅ Found ${otpType}: ${otpValue}`)
              return otpValue
            } else {
              console.log(
                `⚠️ OTP expired at ${state.expires_at}, waiting for fresh ${otpType}...`
              )
            }
          } else {
            // No expiration data, assume valid
            console.log(`✅ Found ${otpType}: ${otpValue}`)
            return otpValue
          }
        } else {
          console.log(`⏳ No ${otpType} found yet, continuing to wait...`)
        }
      } else {
        console.log(`⚠️ Webhook response not successful, retrying...`)
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL))
    } catch (error) {
      retryCount++
      console.error(
        `❌ Error checking for ${otpType} (attempt ${retryCount}):`,
        error.message
      )

      if (retryCount >= MAX_RETRIES) {
        throw new Error(
          `Failed to retrieve ${otpType} after ${MAX_RETRIES} attempts: ${error.message}`
        )
      }

      // Wait longer on error
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL * 2))
    }
  }

  throw new Error(`Timeout waiting for ${otpType} after ${timeoutMs}ms`)
}

/**
 * Notify n8n about voucher generation completion
 */
async function notifyVoucherGenerated(voucherCode, voucherPin) {
  try {
    console.log(`📨 Notifying webhook about voucher generation...`)

    const response = await axios.post(
      `${N8N_BASE_URL}${WEBHOOK_PATH}`,
      {
        content: `Voucher generated successfully! Code: ${voucherCode}, PIN: ${voucherPin}`,
        voucher_code: voucherCode,
        voucher_pin: voucherPin,
        type: 'voucher_generation_complete',
        source: 'playwright_automation',
        timestamp: new Date().toISOString(),
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'playwright-automation/1.0',
        },
      }
    )

    if (response.data.success) {
      console.log(`✅ Voucher data sent successfully to webhook`)
      return true
    } else {
      console.error(`❌ Webhook responded with error:`, response.data.message)
      return false
    }
  } catch (error) {
    console.error(`❌ Failed to notify webhook about voucher:`, error)
    return false
  }
}

/**
 * Check if n8n webhook is responsive
 */
async function checkWebhookHealth() {
  try {
    const response = await axios.post(
      `${N8N_BASE_URL}${WEBHOOK_PATH}`,
      {
        message: '__GET_STATE__',
        type: 'status_check',
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'playwright-automation/1.0',
        },
      }
    )

    return response.status === 200 && response.data && response.data.success
  } catch (error) {
    console.error('❌ Webhook health check failed:', error.message)
    return false
  }
}

// Voucher extraction removed - details come via SMS and webhook processing

/**
 * Enhanced logging with timestamps
 */
function logWithTimestamp(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️'
  console.log(`${emoji} [${timestamp}] ${message}`)
}

// ===========================================
// MAIN AUTOMATION SCRIPT
// ===========================================

;(async () => {
  try {
    // Check webhook health before starting
    logWithTimestamp('🚀 Starting voucher automation with webhook integration')

    const isHealthy = await checkWebhookHealth()
    if (!isHealthy) {
      throw new Error('n8n webhook is not responsive')
    }

    logWithTimestamp('✅ Webhook health check passed')

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to the voucher page
    logWithTimestamp('🌐 Navigating to Gyftr portal...')
    await page.goto(
      'https://www.gyftr.com/amexrewardmultiplier/swiggy-gv-gift-vouchers'
    )

    // Add voucher to cart
    logWithTimestamp('🛒 Adding voucher to cart...')
    
    // Wait for ADD buttons to appear (with timeout)
    console.log('Waiting for ADD buttons...')
    try {
      await page.getByRole('button', { name: 'ADD' }).first().waitFor({ state: 'visible', timeout: 15000 })
      console.log('ADD buttons are visible')
    } catch (e) {
      console.log('Warning: Timeout waiting for ADD buttons, proceeding anyway...')
    }
    
    // Get all ADD buttons
    const allButtons = await page.getByRole('button', { name: 'ADD' }).all()
    console.log(`Found ${allButtons.length} ADD buttons`)
    
    // Target amount: 1000 for goldcharge, 1500 for membership
    const targetAmount = USE_GOLDCHARGE_CARD ? '1000' : '1500'
    logWithTimestamp(`*** Looking for ADD button with amount ${targetAmount} ***`)
    
    let addButtonClicked = false
    
    // Strategy: Check the immediate row (class "vg-gread-row") which contains "ADD - AMOUNT"
    for (let i = 0; i < allButtons.length; i++) {
      try {
        // Get the immediate row containing this button
        const rowText = await allButtons[i].locator('xpath=ancestor::div[contains(@class, "vg-gread-row")]').first().textContent({ timeout: 2000 })
        const normalizedText = rowText?.replace(/\s+/g, ' ').trim() || ''
        console.log(`Button ${i} row: "${normalizedText}"`)
        
        // Check if this row contains "ADD - AMOUNT" pattern
        if (normalizedText.includes(`ADD - ${targetAmount}`)) {
          console.log(`✓ Found amount ${targetAmount} at button ${i}`)
          await allButtons[i].click()
          console.log(`✓ Clicked ADD button for ₹${targetAmount}`)
          addButtonClicked = true
          break
        }
      } catch (e) {
        console.log(`Button ${i}: Skipping (${e.message?.substring(0, 50)}...)`)
      }
    }
    
    // Fallback to correct index based on page structure:
    // Button 0=250, 1=1000, 2=1500, 3=2000
    if (!addButtonClicked) {
      const idx = USE_GOLDCHARGE_CARD ? 1 : 2  // 1 for ₹1000, 2 for ₹1500
      console.log(`⚠ Using fallback index ${idx} for ₹${targetAmount}`)
      if (allButtons.length > idx) {
        await allButtons[idx].click()
        console.log(`✓ Clicked ADD button at index ${idx}`)
      } else {
        // Last resort: use nth selector directly
        console.log(`Only ${allButtons.length} buttons found, using nth(${idx}) selector`)
        await page.getByRole('button', { name: 'ADD' }).nth(idx).click()
        console.log(`✓ Clicked ADD button using nth(${idx})`)
      }
    }
    
    await page.getByRole('link', { name: 'View Cart' }).click()
    await page.getByRole('button', { name: 'PAY NOW' }).click()

    // Fill user details
    logWithTimestamp('📝 Filling user details...')
    await page.getByRole('textbox', { name: 'Enter Mobile' }).fill(MOBILE)
    await page.getByRole('textbox', { name: 'Enter Email' }).fill(EMAIL)
    await page.getByRole('button', { name: 'Get OTP' }).click()

    // Wait for mobile OTP
    logWithTimestamp('📱 Requesting mobile OTP via webhook...')
    console.log(`\n🔗 Send your mobile OTP to: ${N8N_BASE_URL}${WEBHOOK_PATH}`)
    console.log(
      `📋 Example: curl -X POST ${N8N_BASE_URL}${WEBHOOK_PATH} -H "Content-Type: application/json" -d '{"message": "Your OTP is 123456"}'\n`
    )

    const mobileOtp = await getOTPFromWebhook('mobile_otp', 120000) // 2 min timeout

    logWithTimestamp(`📱 Using mobile OTP: ${mobileOtp}`)
    await page.getByRole('textbox', { name: 'Enter OTP' }).fill(mobileOtp)
    await page.getByRole('button', { name: 'Submit' }).click()

    // Skip promotional offers (may not appear in headless mode)
    logWithTimestamp('⏭️ Checking for promotional offers...')
    try {
      await page.getByRole('button', { name: 'No thanks' }).click({ timeout: 5000 })
      logWithTimestamp('✅ Dismissed promotional offer')
    } catch (e) {
      logWithTimestamp('ℹ️ No promotional offer popup found, continuing...')
    }
    await page.getByRole('button', { name: 'Pay Now' }).click()

    // Select payment method and enter CVV
    logWithTimestamp('💳 Setting up payment method...')
    if (USE_GOLDCHARGE_CARD) {
      logWithTimestamp('*** Selecting GOLDCHARGE CARD (id: 1000105) ***')
      await page.locator('[id="1000105"]').click()
      await page.getByRole('textbox', { name: 'C V V' }).fill(GOLDCHARGE_CARD_CVV)
    } else {
      logWithTimestamp('*** Selecting MEMBERSHIP CARD (id: 1000075) ***')
      await page.locator('[id="1000075"]').click()
      await page.getByRole('textbox', { name: 'C V V' }).fill(MEMBERSHIP_CARD_CVV)
    }

    // Click 'Proceed to Pay' and wait for redirect to SafeKey page
    logWithTimestamp('🔄 Proceeding to payment...')
    await page.getByText('Proceed to Pay').click()
    await page.waitForLoadState('networkidle')

    // Wait for payment OTP
    logWithTimestamp('🔐 Requesting payment OTP via webhook...')
    const paymentOtp = await getOTPFromWebhook('payment_otp', 18000) // 3 min timeout

    logWithTimestamp(`🔐 Using payment OTP: ${paymentOtp}`)
    await page
      .getByRole('textbox', { name: 'To Verify this transaction' })
      .fill(paymentOtp)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Wait for payment processing
    logWithTimestamp('⏳ Processing payment...')
    await page.waitForTimeout(5000) // 5 second delay

    // Wait for navigation back to the gyftr confirmation page
    logWithTimestamp('🔄 Waiting for confirmation page...')
    await page.waitForLoadState('networkidle', { timeout: 60000 }) // 60 seconds timeout for payment processing

    logWithTimestamp('✅ Successfully navigated to confirmation page')

    // Payment completed - voucher details will be received via SMS/webhook
    logWithTimestamp('🎉 Payment completed successfully!')
    logWithTimestamp(
      '📱 Voucher details will be sent via SMS and processed by webhook'
    )

    // Cleanup
    logWithTimestamp('🧹 Cleaning up browser...')
    await context.close()
    await browser.close()

    logWithTimestamp('🎊 Payment automation completed successfully!')
    logWithTimestamp(
      '📱 Voucher details will be received via SMS and processed by the webhook'
    )
  } catch (error) {
    logWithTimestamp(`💥 Automation failed: ${error.message}`, 'error')
    console.error('Full error:', error)
    process.exit(1)
  }
})()
