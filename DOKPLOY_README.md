# 🚀 Dokploy Deployment - Complete Package

Everything you need to deploy your voucher automation system on Dokploy.

---

## 📦 What's Included

Your project now has comprehensive Dokploy deployment documentation:

| File | Purpose | Time to Read |
|------|---------|--------------|
| **DOKPLOY_QUICKSTART.md** | Ultra-fast deployment (experienced users) | 2 min |
| **DOKPLOY_DEPLOY_STEPS.md** | Complete step-by-step guide | 10 min |
| **DOKPLOY_TROUBLESHOOTING.md** | Solutions to common issues | Reference |
| **DEPLOYMENT_CHECKLIST.md** | Comprehensive verification checklist | Reference |
| **DOKPLOY_SETUP.md** | Original quick setup guide | 5 min |

---

## 🎯 Start Here

### For Quick Deployment (10 minutes)
→ **Read: [`DOKPLOY_QUICKSTART.md`](DOKPLOY_QUICKSTART.md)**

Copy-paste commands, deploy, done. Perfect if you're experienced with Dokploy.

### For Detailed Step-by-Step (20 minutes)
→ **Read: [`DOKPLOY_DEPLOY_STEPS.md`](DOKPLOY_DEPLOY_STEPS.md)**

Complete walkthrough with explanations, verification steps, and iOS Shortcut setup.

### When Something Goes Wrong
→ **Read: [`DOKPLOY_TROUBLESHOOTING.md`](DOKPLOY_TROUBLESHOOTING.md)**

Comprehensive troubleshooting guide with solutions to common issues.

---

## ⚡ Quick Start (5 Steps)

```bash
# 1. Commit and push your code
git add .
git commit -m "Ready for deployment"
git push origin main

# 2. In Dokploy: Create Application
#    - Type: Docker Compose
#    - Source: GitHub
#    - Repo: your-repo
#    - Branch: main

# 3. Set environment variables in Dokploy
#    (Copy from example.env and update values)

# 4. Add domain: n8n.yourdomain.com
#    - Service: n8n
#    - Port: 5678
#    - SSL: Enabled

# 5. Click "Deploy" and wait 5-8 minutes
```

---

## ✅ What Was Fixed

I've made the following updates to your project:

### 1. **docker-compose.yml**
- ✅ Exposed n8n port 5678 (required for Dokploy ingress)
- ✅ Already configured with proper networking
- ✅ Health checks configured for both services
- ✅ Volumes properly mounted

### 2. **Documentation Added**
- ✅ Complete deployment guides
- ✅ Quick reference cards
- ✅ Troubleshooting documentation
- ✅ Step-by-step instructions

### 3. **Ready to Deploy**
- ✅ All files committed (after you commit)
- ✅ Dockerfile.playwright already optimized
- ✅ Environment variables documented
- ✅ Health checks working

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure you have:

- [ ] **Dokploy instance** running and accessible
- [ ] **Domain name** configured (e.g., `yourdomain.com`)
- [ ] **DNS A record** pointing to Dokploy server
- [ ] **GitHub repository** pushed and up-to-date
- [ ] **Credentials ready:**
  - [ ] AmEx Gyftr mobile number
  - [ ] AmEx Gyftr email
  - [ ] Card CVV(s)
  - [ ] (Optional) Swiggy API credentials

---

## 🔧 System Requirements

### Server (Dokploy Host)
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum (2GB for Playwright, 1GB for n8n, 1GB for system)
- **Storage**: 10GB free space
- **OS**: Ubuntu 20.04+ or compatible
- **Docker**: 20.10+ installed
- **Network**: Ports 80, 443 open for SSL

### Domain
- DNS A record pointing to server IP
- Subdomain for n8n (e.g., `n8n.yourdomain.com`)
- DNS propagation completed (can take 5-15 minutes)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Dokploy Server                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Docker Compose Network                  │  │
│  │                                                    │  │
│  │  ┌─────────────────┐    ┌──────────────────────┐│  │
│  │  │   n8n Service   │◄──►│ Playwright Service   ││  │
│  │  │                 │    │                      ││  │
│  │  │ • Workflow      │    │ • Browser Automation ││  │
│  │  │ • Webhook       │    │ • OTP Polling        ││  │
│  │  │ • Auto-claim    │    │ • Purchase Flow      ││  │
│  │  │                 │    │                      ││  │
│  │  │ Port: 5678      │    │ Port: 3000 (int)     ││  │
│  │  └────────▲────────┘    └──────────────────────┘│  │
│  │           │                                       │  │
│  └───────────┼───────────────────────────────────────┘  │
│              │                                          │
└──────────────┼──────────────────────────────────────────┘
               │
               │ HTTPS (SSL)
               │
       ┌───────▼────────┐
       │  Dokploy       │
       │  Ingress       │
       │  (Traefik)     │
       └───────▲────────┘
               │
               │ HTTPS
               │
    ┌──────────▼──────────┐
    │   n8n.yourdomain.com│
    │                      │
    │  • User Access       │
    │  • Webhook Endpoint  │
    └──────────┬───────────┘
               │
               │
    ┌──────────▼──────────┐
    │   iOS Shortcut      │
    │   (iPhone)          │
    │                     │
    │  • SMS Detection    │
    │  • OTP Forwarding   │
    └─────────────────────┘
```

---

## 🔐 Environment Variables Reference

### Required (Must Set)

```bash
# AmEx Gyftr
MOBILE=your_mobile_number        # 10-digit mobile
EMAIL=your_email@example.com     # Your email
CARD_CVV=123                     # Card CVV
GOLD_CHARGE=false                # true/false

# n8n Configuration
N8N_HOST=n8n.yourdomain.com      # Your domain
N8N_PORT=5678                    # Keep as 5678
N8N_PROTOCOL=https               # Use https in production
N8N_SECURE_COOKIE=false          # Keep as false for Dokploy
N8N_BASE_URL=https://n8n.yourdomain.com  # Full URL
WEBHOOK_PATH=/webhook/ios-sms    # Webhook path
GENERIC_TIMEZONE=Asia/Kolkata    # Your timezone
```

### Optional

```bash
# Gold Charge (if using)
GOLD_CHARGE_CVV=456              # Gold card CVV

# Swiggy Auto-Claim (if using)
SWIGGY_VOUCHER_CLAIM_URL=https://chkout.swiggy.com/swiggymoney/voucher/claim
SWIGGY_DEVICE_ID=your_device_id
SWIGGY_TID=your_tid
SWIGGY_TOKEN=your_token

# System
PLAYWRIGHT_HOST_PORT=3010        # External port (optional)
TZ=Asia/Kolkata                  # System timezone
NODE_ENV=production              # Production mode
```

---

## 🧪 Testing Your Deployment

### 1. Health Checks

```bash
# Test n8n
curl https://n8n.yourdomain.com/healthz
# Expected: {"status":"ok"}

# Test Playwright (if exposed)
curl http://your-server-ip:3010/health
# Expected: {"status":"healthy",...}
```

### 2. Webhook Test

```bash
# Test mobile OTP parsing
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Your OTP is 123456"}'

# Expected:
# {
#   "status": "received",
#   "success": true,
#   "content_type": "mobile_otp",
#   "mobile_otp": "123456",
#   "expires_at": "2025-12-20T..."
# }
```

### 3. Full Automation Test

```bash
# Trigger automation (will attempt real purchase!)
curl -X POST http://your-server-ip:3010/start \
  -H "Content-Type: application/json" \
  -d '{"goldCharge": false}'
```

**⚠️ Warning:** This will attempt a real purchase. Only test when ready!

---

## 📱 iOS Shortcut Configuration

### Quick Setup

1. **Shortcuts app** → **Automation** → **+ New Automation**
2. **When I receive a message** (any sender, any message)
3. **Add Action** → **Get Contents of URL**
4. Configure:
   ```
   URL: https://n8n.yourdomain.com/webhook/ios-sms
   Method: POST
   Headers: Content-Type: application/json
   Body: {"message": "[Message Content]"}
   ```
   (Use variable picker for `Message Content`)
5. **Turn OFF** "Ask Before Running"
6. **Save**

### Testing

Send yourself: "OTP is 123456"
- ✅ Shortcut should run automatically
- ✅ Check n8n Executions for received data
- ✅ Verify OTP parsed correctly

---

## 🎯 Success Criteria

Your deployment is successful when:

1. ✅ **Both containers healthy**
   ```bash
   docker ps | grep -E 'n8n|playwright'
   # Both should show "healthy" status
   ```

2. ✅ **n8n accessible via HTTPS**
   ```bash
   curl https://n8n.yourdomain.com/healthz
   # Returns: {"status":"ok"}
   ```

3. ✅ **Webhook receives data**
   ```bash
   # Test webhook returns success
   ```

4. ✅ **iOS Shortcut works**
   - Send test SMS
   - Check n8n Executions
   - Verify OTP stored

5. ✅ **Full automation completes**
   - Trigger automation
   - Send OTPs via Shortcut
   - Voucher purchased successfully

---

## 🆘 Common Issues & Quick Fixes

| Issue | Quick Fix | Details |
|-------|-----------|---------|
| **n8n not accessible** | Check DNS: `dig n8n.yourdomain.com` | [Troubleshooting Guide](DOKPLOY_TROUBLESHOOTING.md#-n8n-not-accessible) |
| **Containers not starting** | Check logs: `docker logs n8n` | [Troubleshooting Guide](DOKPLOY_TROUBLESHOOTING.md#-containers-not-starting) |
| **Webhook 404** | Activate workflow in n8n | [Troubleshooting Guide](DOKPLOY_TROUBLESHOOTING.md#-webhook-returns-404) |
| **OTP timeout** | Verify Shortcut automation enabled | [Troubleshooting Guide](DOKPLOY_TROUBLESHOOTING.md#-automation-times-out) |
| **SSL not working** | Wait for DNS propagation (5-15 min) | [Troubleshooting Guide](DOKPLOY_TROUBLESHOOTING.md#-ssltls-issues) |

---

## 📚 Documentation Structure

```
📁 Voucher Automation Documentation
│
├── 🚀 DOKPLOY_README.md (THIS FILE)
│   └── Overview and navigation
│
├── ⚡ DOKPLOY_QUICKSTART.md
│   └── 10-minute deployment for pros
│
├── 📖 DOKPLOY_DEPLOY_STEPS.md
│   └── Complete step-by-step guide
│
├── 🔧 DOKPLOY_TROUBLESHOOTING.md
│   └── Comprehensive problem-solving
│
├── ✅ DEPLOYMENT_CHECKLIST.md
│   └── Verification checklist
│
├── 📋 DOKPLOY_SETUP.md
│   └── Original quick setup guide
│
├── 📚 DEPLOYMENT.md
│   └── Detailed deployment documentation
│
├── 🏗️ ARCHITECTURE.md
│   └── System architecture overview
│
└── 🔍 QUICK_REFERENCE.md
    └── Command reference
```

---

## 🔄 Deployment Workflow

```
┌─────────────────┐
│ 1. Prepare Code │
│   • Commit      │
│   • Push        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Dokploy      │
│   • Create App  │
│   • Set Env     │
│   • Add Domain  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Deploy       │
│   • Build       │
│   • Start       │
│   • Health Check│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Configure    │
│   • Import Flow │
│   • Activate    │
│   • iOS Shortcut│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Test         │
│   • Health      │
│   • Webhook     │
│   • End-to-End  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. Monitor      │
│   • Logs        │
│   • Executions  │
│   • Resources   │
└─────────────────┘
```

---

## 🎓 Next Steps After Deployment

### Immediate (First Hour)
1. ✅ Verify all health checks pass
2. ✅ Test webhook with sample data
3. ✅ Configure iOS Shortcut
4. ✅ Test iOS Shortcut with test SMS

### First Day
1. 📊 Monitor logs for errors
2. 🧪 Test full automation flow
3. 📝 Document any custom changes
4. 🔐 Verify security settings

### First Week
1. 📈 Monitor execution success rate
2. ⚙️ Optimize polling intervals if needed
3. 🔄 Test edge cases (late OTP, expired OTP)
4. 📚 Update team documentation

### Ongoing
1. 🔍 Weekly log review
2. 🔒 Monthly credential rotation
3. 📦 Monthly dependency updates
4. 🗄️ Monthly backup verification

---

## 💡 Pro Tips

### Performance
- Allocate 4GB+ RAM to server for smooth operation
- Use SSD storage for Docker volumes
- Monitor resource usage: `docker stats`

### Security
- Store credentials only in Dokploy environment variables
- Never commit `.env` files to Git
- Rotate Swiggy tokens monthly
- Use strong n8n password

### Reliability
- Set up monitoring/alerting
- Keep backup of n8n workflows
- Document all custom changes
- Test regularly (weekly)

### Debugging
- Always check logs first: `docker logs n8n`
- Use health endpoints for quick checks
- Test components individually before full flow
- Save screenshots for troubleshooting

---

## 📞 Support & Resources

### Documentation
- 📖 [Step-by-Step Guide](DOKPLOY_DEPLOY_STEPS.md)
- ⚡ [Quick Start](DOKPLOY_QUICKSTART.md)
- 🔧 [Troubleshooting](DOKPLOY_TROUBLESHOOTING.md)
- ✅ [Checklist](DEPLOYMENT_CHECKLIST.md)

### Community
- 🐛 [Report Issues](https://github.com/bluebox/automate_vouchers/issues)
- 💬 [Discussions](https://github.com/bluebox/automate_vouchers/discussions)
- 📧 Contact: See [CONTRIBUTING.md](CONTRIBUTING.md)

### Tools
- [Dokploy Documentation](https://docs.dokploy.com)
- [n8n Documentation](https://docs.n8n.io)
- [Playwright Documentation](https://playwright.dev)

---

## 📊 Deployment Metrics

**Typical deployment timeline:**

- ⏱️ Repository setup: 5 minutes
- ⏱️ Dokploy configuration: 5 minutes
- ⏱️ Build & deployment: 5-8 minutes
- ⏱️ Testing & verification: 5 minutes
- ⏱️ iOS Shortcut setup: 5 minutes

**Total: 25-30 minutes**

---

## ✅ Pre-Flight Checklist

Before clicking "Deploy":

- [ ] Code committed and pushed to GitHub
- [ ] All environment variables set in Dokploy
- [ ] Domain DNS pointing to server (and propagated)
- [ ] SSL/TLS configured in Dokploy
- [ ] docker-compose.yml reviewed and correct
- [ ] Server has adequate resources (4GB+ RAM)
- [ ] Ports 80/443 open on firewall

---

## 🎉 You're Ready!

Everything is configured and documented. Choose your path:

- **Fast Track** (10 min): → [`DOKPLOY_QUICKSTART.md`](DOKPLOY_QUICKSTART.md)
- **Detailed Guide** (20 min): → [`DOKPLOY_DEPLOY_STEPS.md`](DOKPLOY_DEPLOY_STEPS.md)
- **Just Checklist**: → [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)

**Let's deploy! 🚀**

---

**Document Version:** 1.0  
**Last Updated:** December 20, 2025  
**Maintainer:** Harshit Luthra

---

*Questions? Issues? Check [DOKPLOY_TROUBLESHOOTING.md](DOKPLOY_TROUBLESHOOTING.md) or [create an issue](https://github.com/bluebox/automate_vouchers/issues).*
