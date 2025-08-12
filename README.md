# Voucher Automation System

Automate buying and claiming Swiggy vouchers from the AmEx Gyftr portal using Playwright, n8n webhooks, and an iOS Shortcut.

## 🎬 Demo

> Demo video: [Watch the MP4](assets/Voucher%20Automation.mp4)

![System Overview](assets/image.png)

## ✨ Features

- Headless Playwright automation for Gyftr checkout
- iOS Shortcuts → n8n webhook → OTP/voucher parsing
- Auto-claim Swiggy vouchers via API (optional)

## 📦 Prerequisites

- Node.js 16+
- Python 3.8+
- An n8n instance (cloud or self-hosted)
- iOS device with the Shortcuts app

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd automate_vouchers
npm install

# Create environment file
cp example.env .env
```

## 🔧 Configure

Set the following in `.env` (see `example.env` for all options):

- MOBILE, EMAIL, CARD_CVV, GOLD_CHARGE_CVV, GOLD_CHARGE
- N8N_BASE_URL, WEBHOOK_PATH
- Optional for auto-claim: SWIGGY_VOUCHER_CLAIM_URL, SWIGGY_DEVICE_ID, SWIGGY_TID, SWIGGY_TOKEN

## ▶️ Run

- One-off automation:

```bash
npm start
# or
node gyftr_automate.js
```

- Service mode (HTTP trigger on :3000):

```bash
npm run service
# POST http://localhost:3000/start  { "goldCharge": true|false }
```

- Docker:

```bash
docker-compose up -d
```

## 📱 iOS Shortcut (SMS → Webhook)

1. Create a new Shortcut
2. Add “Get Contents of URL”
   - URL: `<your-n8n>/webhook/ios-sms`
   - Method: POST
   - Headers: `Content-Type: application/json`
   - Body (JSON): `{ "text": "{{Shortcut Input}}" }`
3. Create an Automation → “Message” trigger
   - From: your SMS sender(s)
   - Contains: keywords like “OTP”, “SafeKey”, “voucher”
4. Action: Run your Shortcut

Visual guide:

![Shortcut setup 1](assets/setting_up_shortcut.png)

![Shortcut setup 2](assets/setting_up_shortcut_2.png)

## 🔁 n8n Workflow

1. Import `n8n-otp-voucher-workflow.json`
2. Copy the webhook URL and use it in your Shortcut
3. Activate the workflow

The workflow stores OTPs/voucher data briefly (TTL ~40s) and can auto-claim Swiggy vouchers if headers are provided via env.

## 🎫 Swiggy Auto-Claim (Optional)

- Configure `SWIGGY_*` env vars
- The workflow will PATCH `SWIGGY_VOUCHER_CLAIM_URL` with code + pin
- Responses handled: success (0), already claimed (7), other errors

## 🧱 Architecture & Advanced Docs

See `SYSTEM_ARCHITECTURE.md` for full flow, diagrams, and advanced notes.

## 🤝 Contributing

See `CONTRIBUTING.md`. Please don’t include secrets in issues/PRs.

## 📄 License

BSD 2-Clause License (see `LICENSE`).
