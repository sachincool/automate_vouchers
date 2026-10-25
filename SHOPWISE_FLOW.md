# ShopWise (Giftstacc) Purchase Flow — DOM Mapping

> Replaces the old Gyftr flow. Portal: `https://shopwise.giftstacc.com`, powered by Giftstacc / "Customer Capital". Mapped live on 2026-06-09 against the Amazon Pay E-Gift Voucher.

## Key differences vs. Gyftr

| Gyftr (old) | ShopWise (new) |
|---|---|
| `gyftr.com/amexrewardmultiplier/...` | `shopwise.giftstacc.com` |
| No login (guest checkout, entered mobile+email at checkout) | **Mobile + OTP login required**; name/email/mobile come from the account (read-only at checkout) |
| ADD → View Cart → PAY NOW (multi-step cart) | Select denomination qty → **Continue** → **Buy now** (no separate cart) |
| Card chosen by element id `1000105`/`1000075` on a payment page | Card chosen for *reward calc* via dropdown; actual payment card selected on the post-"Buy now" gateway (NOT yet mapped) |
| `vg-gread-row`, "ADD - 1500" text | Denomination tiles with "Increase by one" / "Decrease by one" steppers |
| Denominations incl. ₹1,500 | Amazon Pay tiles: ₹500 / ₹1,000 / ₹2,500 / ₹5,000 / ₹10,000 (**no ₹1,500**) |

## Stage 0 — Login (`sso.ai-loyalty.com/Login/GIFT-AMX-PRDSTACC-20251008`)

Reached via the storefront **Login** link. Mobile + 4-digit SMS OTP. No password.

| Step | Selector |
|---|---|
| Mobile field | `input[type="tel"]`, placeholder `"Enter your 10 digit mobile number"` |
| Request OTP | `button[type="submit"]` text `"Get OTP & Continue"` |
| OTP digits (4) | four `input[type="password"]` boxes (auto-advance; typing `"9374"` into the first distributes) |
| Submit | `button[type="submit"]` text `"Validate and Login"` |
| Resend | "Didn't Receive OTP? Resend OTP" after a ~30s countdown |

Login OTP arrives by SMS → reuse the existing n8n relay (this is a NEW `login_otp` type to parse, in addition to payment OTP).

On success: redirect to `shopwise.giftstacc.com/` with account avatar (initials) top-right.

## Stage 1 — Product page (`/giftcard?productId=<urlencoded-id>`)

- Products are addressable directly by `productId` query param (URL-encoded base64). Amazon Pay = `gko2OEEac6Y24dmH/bBa7g==`.
- Categories addressable by `categoryId` (e.g. Dining = `/productlist?categoryId=...`).
- Can also be reached via the top search box (`input[placeholder="Search for gift cards"]`) → autocomplete suggestion (e.g. "Amazon Pay E-Gift Voucher").

Elements:
| Element | Selector |
|---|---|
| Reward-calc card dropdown | combobox showing e.g. "American Express® Platinum Card" — selects which card's reward-points estimate is shown ("YOU WILL EARN: N Reward Points") |
| "Remaining Limit" | text badge (e.g. `₹12500`) — **monthly remaining purchase cap; read for milestone logic** |
| Denomination increment | `button[name="Increase by one"]` (one per tile) |
| Denomination decrement | `button[name="Decrease by one"]` (appears after qty ≥ 1) |
| Qty value | numeric input in the row (e.g. shows `1`) |
| Running total | "N Gift Voucher / Convenience Fee (1.5%)+GST / Total Amount" summary |
| Proceed | `button` text `"Continue"` |

Convenience fee = 1.5% + 18% GST on the fee (₹1,000 → ₹17.70 → total ₹1,017.70).
Quantity capped at 10 per denomination ("Choose your Denomination (up to 10)").

## Stage 2 — Checkout/review (`/card?productId=<id>`)

| Element | Selector |
|---|---|
| Qty stepper | `−` / `+` around qty value (same as stage 1) |
| Card dropdown | "Calculate Reward Points on" combobox (reward estimate only) |
| User Details (collapsible) | toggle reveals **read-only** Name / Mobile No. / Email (from account; NOT editable) |
| Info accordions | Important Instructions / How to use / Terms & Conditions / Note |
| **Pay** | `button` text `"Buy now with ₹ <total>"` ← **irreversible payment trigger** |

## Stage 3 — Payment gateway (PARTIALLY MAPPED, live 2026-06-09)

Clicking "Buy now" opens a **PayU** payment modal (rendered in a **cross-origin iframe** — invisible to the accessibility tree / `find`; the automation must use Playwright `page.frameLocator()` to drive it; coordinate-clicking from the Chrome extension does NOT reliably reach iframe buttons).

Observed:
- Header: merchant "CUSTCAP SOLUTIONS", "Total Payable ₹<total>", "Credit Card".
- **PREFERRED PAYMENT OPTIONS**: saved cards, e.g. two "AMEX Credit Card ****1000" each with an "Offer" badge and **"No CVV required."**. Selecting one shows "This card does not require a CVV. Complete your transaction with single click" and a **"PAY NOW"** button (bottom bar, with "₹<total> / View Breakup"). → Using a saved no-CVV card means **no CVV is entered by anyone** (sidesteps the CVV constraint entirely). Both saved cards display identically (****1000) with no distinguishing expiry/name — operator must know which is which.
- **"Add new card"** / CARD DETAILS form (Card Number / Expiry / CVV / Name on Card / save-card checkbox) for a new card — Claude will NOT use this (entering card number/CVV is off-limits).
- After PAY NOW: a **PineLabs/Plural "Processing your payment..." screen** with "Transaction Id: <id>" (e.g. A0HJ5FV8ERUL), "DO NOT CLOSE THIS WINDOW", and a "Go to payment page" link. The Amex **SafeKey 3DS OTP** step follows here.
- **Not yet observed:** the actual SafeKey OTP entry field + the success/confirmation page (a live run stalled at SafeKey because no OTP was entered, then the ShopWise session timed out). Needs a clean run with the OTP relay working.

## Relay status (diagnosed 2026-06-09 via n8n execution log)

- n8n + webhook + parser + TTL storage: **VERIFIED WORKING** (injected a SafeKey sample → parsed/stored `payment_otp` and returned via `__GET_STATE__`).
- **iOS Shortcut → n8n hop: NOT WORKING.** n8n's retained execution history contained ONLY Claude's own `__GET_STATE__` health checks — zero forwarded OTP SMS during the live login/payment window. The phone→n8n forwarding must be fixed before unattended automation can fetch login/payment OTPs. Webhook target the shortcut must POST to: `https://n8n.harshit.cloud/webhook/ios-sms` with body `{"message":"<full SMS text>"}`.

## SMS formats (for the n8n parser — captured from real messages 2026-06-09)

> The current parser (built for Gyftr) does NOT correctly handle these — see gaps below.

**Login OTP (NEW type, 4-digit):**
```
9374 is your ShopWise login OTP. Do not share it with anyone for security reasons. Team ShopWise powered by CustCap
```
Suggested regex: `/(\d{4,6})\s+is your ShopWise login OTP/i`
Gap: current `parseMobileOTP` fails on this (4-digit code precedes "OTP" with words between; 6-digit fallback doesn't fire on a 4-digit code).

**Payment OTP (Amex SafeKey):**
```
Your Amex SafeKey One-Time Password for INR 1,526.55, at CUSTCAP SOLUTIONS PVT LTD is XXXXXX. Valid for 10 mins for Card ending XXXXX. Do not disclose it to anyone.
```
Suggested regex: `/SafeKey One-Time Password for INR [\d.,]+,?\s*at .+? is\s*(\d{4,8})/i`
Current `parsePaymentOTP` happens to extract `XXXXXX` correctly (safekey → lazy match skips the comma-broken amount). Merchant is **CUSTCAP SOLUTIONS PVT LTD**; card ending shown.

**Voucher delivery:**
```
Dear Card Holder, Congratulations, your Amazon Pay E-Gift Voucher is here. Order . Voucher Details: 601487XXXXXXXXXX. Additional Details: XXXXXXXXXXXXXX. Value: 1000. Valid till 30-05-2027. Check your email for redemption steps and terms of use. Team ShopWise powered by CustCap
```
Suggested regex: code `/Voucher Details:\s*([0-9A-Z]+)/i`, pin/extra `/Additional Details:\s*([0-9A-Z]+)/i`, value `/Value:\s*(\d+)/i`, validity `/Valid till\s*([\d-]+)/i`.

**REDEMPTION SEMANTICS (per user, for Amazon Pay):** the **"Additional Details"** alphanumeric value (e.g. `XXXXXXXXXXXXXX`) is the **redeemable claim code** you enter at amazon.in/addgiftcard; the 16-digit "Voucher Details" (e.g. `601487XXXXXXXXXX`) is the card/reference number. Parser stores Additional Details → `voucher_pin`, Voucher Details → `voucher_code`. When building auto-redemption, use the **Additional Details / `voucher_pin`** field as the claim code for Amazon Pay (per-brand mapping may differ).
Gap: current `determineContentType` classifies this as `mobile_otp` (no "code"/"pin"/"gift card" keyword — it says "Voucher Details"/"Additional Details"/"E-Gift Voucher"), so it never reaches the voucher parser. Must add ShopWise voucher detection.

## Session behavior

- ShopWise sessions **expire on inactivity** (observed "Session Expired — Session expired due to inactivity" after a few minutes idle, kicked back to logged-out home). Automation must run the flow promptly and detect the session-expired modal / logged-out state to re-login.

## Reuse assessment

- n8n OTP relay + TTL state store: **reuse**; add a `login_otp` parser path (4-digit) alongside payment OTP.
- Playwright flow: **rewrite** — selectors above; flow is shorter (login → product → qty → Continue → Buy now → gateway).
- Card env vars / `USE_GOLDCHARGE_CARD` logic: revisit once Stage 3 (payment card selection) is mapped.
