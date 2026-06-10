# ShopWise Voucher Automation

Automates buying AmEx Reward Multiplier gift vouchers end-to-end on the **ShopWise** (Giftstacc) portal — login, denomination selection, PayU saved-card payment, Amex SafeKey 3DS, and voucher capture — driven from a simple n8n form. Built on Playwright + n8n + an iOS Shortcut that relays SMS OTPs back to the automation.

> ShopWise replaced the old **Gyftr** portal in Feb 2026. The Gyftr code (`server.js`, `gyftr_automate.js`) is **legacy / retired** and kept only for reference. See [Legacy (Gyftr)](#-legacy-gyftr--retired) below.

---

## ✨ Quick start — buy a voucher from the n8n Form (primary)

The everyday way to buy is the **"Buy a ShopWise Voucher"** n8n Form. No CLI, no JSON — just pick and submit.

1. Import `shopwise-buy-form-workflow.json` into n8n and **activate** it.
2. Open the form at `https://<your-n8n-host>/form/buy-voucher`.
3. Fill in three fields and submit:
   - **What do you want to buy?** — a dropdown of preset voucher options, e.g.
     - `Amazon Pay ₹1,000 — Gold Charge`
     - `Amazon Pay ₹1,500 — MRCC (1000+500)`
     - `Amazon Pay ₹2,500 — MRCC`
     - `Amazon Pay ₹5,000 — MRCC`
   - **How many transactions?** — quantity (each one is a separate checkout = one milestone tick).
   - **Mode** — `Dry run (no charge)` or `Buy for real`.
4. The form runs the purchase **server-side** (it POSTs a plan to the `playwright-service` container) and shows the result.

Each dropdown option maps to a brand `productId`, a PayU card slot, and a denomination breakdown in the form's catalog Code node — see [Adding a new brand / voucher](#-adding-a-new-brand--voucher).

---

## 🧱 Architecture

Incoming SMS on the phone (login OTP, Amex SafeKey OTP, voucher delivery) are forwarded by an iOS Shortcut to an n8n webhook. n8n parses and stores them, hosts the Form and Orchestrator, and triggers the Playwright service container that drives the browser and pulls OTPs back from n8n on demand.

```
 ┌─────────────┐   SMS (login OTP / SafeKey OTP / voucher)
 │   Phone     │ ───────────────────────────────────────────┐
 └─────────────┘                                             │
        │  iOS Shortcut (SMS automation)                     │
        │  POST {text} → <n8n>/webhook/ios-sms               │
        ▼                                                     │
 ┌──────────────────────────────────────────────────┐       │
 │                      n8n                           │       │
 │  • /webhook/ios-sms relay + parser (40s OTP TTL)   │◀──────┘
 │  • persistent ledger (vouchers + milestone counts) │
 │  • Form  "Buy a ShopWise Voucher"                  │
 │  • Orchestrator (plan-driven batch)                │
 └──────────────────────────────────────────────────┘
        │  POST /run {plan, dryRun}            ▲
        ▼                                      │ poll OTPs (GET /webhook/ios-sms)
 ┌──────────────────────────────────────────────────┐
 │   playwright-service container                     │
 │   shopwise_automate.js --serve (headful, xvfb)     │
 │   login → product → denominations → PayU saved     │
 │   card → SafeKey 3DS OTP → voucher capture         │
 │                → reports transaction to n8n ledger │
 └────────────────────────────┬───────────────────────┘
                              ▼
                     ShopWise (Giftstacc)
```

- **Login:** mobile number + 4-digit SMS OTP (no password).
- **Payment:** PayU saved "No CVV required" AmEx cards. The SafeKey 3DS OTP is auto-filled from the n8n-relayed SMS.
- **Hosting:** n8n + `playwright-service` run together on a Dokploy host (see `docker-compose.yml`).

### Milestones & cards

| Card | PayU slot | Milestone |
| --- | --- | --- |
| Gold Charge | `0` | 6 × ₹1,000 |
| MRCC | `1` | 4 × ₹1,500 (+₹15k) |

---

## 🧩 Components

| File | Role |
| --- | --- |
| `shopwise_automate.js` | The runnable Playwright automation: CLI (`--plan`) and HTTP service (`--serve`). Does login, denomination selection, PayU payment, SafeKey 3DS auto-fill, voucher capture, and reports each purchase to the n8n ledger. |
| `shopwise-parser.js` | n8n Code-node parser + milestone ledger. Classifies `login_otp` / `mobile_otp` / `payment_otp` (SafeKey) / voucher-delivery SMS. OTPs get a 40s TTL; vouchers and per-card milestone counters persist in a non-expiring ledger. Handles `{type:"transaction"}` and `{type:"reset_ledger"}` events. |
| `shopwise-plan.example.json` | Plan format: `brands` (name→productId), `cards` (name→PayU slot), `jobs` (`brand`, `card`, `denominations`, `count`). |
| `shopwise-buy-form-workflow.json` | **Primary UI** — the n8n Form "Buy a ShopWise Voucher". Form → Build Plan (catalog) → POST `/run` → Show result. |
| `shopwise-orchestrator-workflow.json` | Plan-driven batch: Manual/Schedule trigger → Build Plan (edit me) → POST `/run` → Summarize. |
| `n8n-otp-voucher-workflow.json` | OTP & Voucher Handler: `/webhook/ios-sms` relay → parser → ledger → Respond. (Also includes optional legacy Swiggy auto-claim nodes.) |
| `Dockerfile.playwright` / `docker-compose.yml` | The `playwright-service` container running `shopwise_automate.js --serve` headful under xvfb. |
| `SHOPWISE_FLOW.md` | DOM/flow mapping + SMS formats. |

Playwright is pinned to **1.54.1**.

---

## ⚙️ Setup & configuration

```bash
npm install
cp example.env .env
```

Set at least `MOBILE` and `N8N_BASE_URL` in `.env`. Key variables (see `example.env` for the full list):

| Variable | Purpose |
| --- | --- |
| `MOBILE` | Mobile number used to log in (4-digit SMS OTP, no password). |
| `N8N_BASE_URL` | Where the automation polls OTPs, e.g. `http://n8n:5678` in Docker or `https://<your-n8n-host>`. |
| `WEBHOOK_PATH` | OTP relay path. Default `/webhook/ios-sms`. |
| `SHOPWISE_BASE_URL` | Default `https://shopwise.giftstacc.com`. |
| `SHOPWISE_LOGIN_URL` | SSO login URL. |
| `PRODUCT_ID` | Default product (Amazon Pay E-Gift Voucher = `gko2OEEac6Y24dmH/bBa7g==`). |
| `DENOMINATIONS` | Default denomination plan, e.g. `1000x1` or `1000x1,500x1`. |
| `PORT` | Service port. Default `3000`. |
| `HEADLESS` | `true` (default) or `false` to watch the browser. |
| `MANUAL_3DS` | `true` to pause for a human to complete the SafeKey step (the OTP is printed for you). |

> Do not commit real secrets. Use placeholders like `https://<your-n8n-host>` in shared configs.

### n8n parser node

Import `n8n-otp-voucher-workflow.json`, then paste `shopwise-parser.js` into the **"OTP/Voucher Parser & Storage"** Code node and add the `login_otp` line to the **Respond to Webhook** node (details in `SHOPWISE_FLOW.md`). Activate the workflow.

### playwright-service

The container runs `xvfb-run -a node shopwise_automate.js --serve`, exposing `POST /run` and `GET /health` on `PORT` (default 3000). Bring up the stack on the Dokploy host:

```bash
docker-compose up -d
```

---

## ▶️ Other run modes

### CLI (`--plan`)

```bash
# Safe dry run — logs in + selects vouchers, never pays:
node shopwise_automate.js --plan shopwise-plan.example.json --dry-run

# Watch it live (a window opens):
HEADLESS=false node shopwise_automate.js --plan shopwise-plan.example.json --dry-run

# Real run of a whole plan (buys every job, count× each):
node shopwise_automate.js --plan shopwise-plan.example.json

# Run only job index N:
node shopwise_automate.js --plan shopwise-plan.example.json --only 0

# Pause for manual SafeKey entry:
MANUAL_3DS=true node shopwise_automate.js --plan shopwise-plan.example.json
```

### HTTP service (`--serve`)

```bash
node shopwise_automate.js --serve
# POST /run  { "plan": {...}, "dryRun": true }   on :3000  (also accepts planFile, only)
# GET  /health
```

### Orchestrator workflow

Import `shopwise-orchestrator-workflow.json` for plan-driven batches. Edit the plan inline in the **"Build Plan (edit me)"** Code node, then fire it from the **Manual** trigger (or activate the monthly **Schedule** trigger). It POSTs the plan to `http://playwright-service:3000/run` and a **Summarize** node reports `N/N jobs OK` plus any captured vouchers.

---

## 🔧 Adding a new brand / voucher

1. Open the product on ShopWise and copy its `productId` from the URL: `/giftcard?productId=...`.
2. **For the Form (primary):** add a line to the `CATALOG` in the **"Build Plan from selection"** Code node of `shopwise-buy-form-workflow.json` — the dropdown option label must match the catalog key:
   ```js
   'Swiggy ₹1,500 — MRCC': { brand: 'swiggy', productId: '<from product URL>', card: 'mrcc', denominations: [{ amount: 1000, qty: 1 }, { amount: 500, qty: 1 }] }
   ```
   Then add the same label as a dropdown option in the Form node.
3. **For CLI/Orchestrator plans:** add the brand to `brands{}` and a job to `jobs[]` in your plan JSON.

PayU card slots are `0` = Gold Charge, `1` = MRCC.

---

## 🔁 n8n relay + iOS Shortcut

The phone forwards the three SMS types to n8n so the automation can read them.

**iOS Shortcut:**

1. Create a Shortcut with **Get Contents of URL**:
   - URL: `https://<your-n8n-host>/webhook/ios-sms`
   - Method: `POST`, Header `Content-Type: application/json`
   - Body (JSON): `{ "text": "{{Shortcut Input}}" }`
2. Create an **Automation → Message** trigger that runs the Shortcut when an SMS contains one of the trigger keywords:
   - `ShopWise login OTP` — login OTP
   - `CUSTCAP SOLUTIONS` — Amex SafeKey (payment) OTP
   - `E-Gift Voucher` — voucher delivery

n8n stores OTPs with a 40s TTL (the automation polls for them) and persists vouchers + milestone counters in a non-expiring ledger.

---

## 📄 Flow & DOM reference

See **[`SHOPWISE_FLOW.md`](SHOPWISE_FLOW.md)** for the full DOM/flow mapping and exact SMS formats.

---

## 🗄️ Legacy (Gyftr) — retired

The original Gyftr automation is no longer used. These files are kept for reference only and are **not** part of the current flow:

- `gyftr_automate.js` — old Gyftr Playwright automation
- `server.js` — old Gyftr HTTP service
- Any `Gyftr` env vars / config in `example.env` (e.g. `EMAIL`, `MEMBERSHIP_CARD_CVV`, `GOLDCHARGE_CARD_CVV`, `USE_GOLDCHARGE_CARD`, the optional `SWIGGY_*` auto-claim)

---

## 📄 License

BSD 2-Clause License — see [`LICENSE`](LICENSE).
