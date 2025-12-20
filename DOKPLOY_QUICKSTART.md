# ⚡ Dokploy Quick Start (10 Minutes)

Ultra-fast deployment guide for experienced users.

## 🎯 Prerequisites Checklist
- [ ] Dokploy instance running
- [ ] Domain DNS pointing to Dokploy server
- [ ] GitHub repo committed and pushed
- [ ] Credentials ready

---

## 🚀 Deployment Steps

### 1️⃣ Create Application (2 min)
```
Dokploy Dashboard → Create Application → Docker Compose
→ Connect GitHub → Select repo → Select branch (main)
```

### 2️⃣ Set Environment Variables (3 min)
```
Settings → Environment Variables → Add these:
```

**Copy-paste this block (update YOUR_VALUES):**
```bash
MOBILE=YOUR_MOBILE
EMAIL=YOUR_EMAIL@example.com
CARD_CVV=YOUR_CVV
GOLD_CHARGE_CVV=YOUR_GOLD_CVV
GOLD_CHARGE=false
N8N_HOST=n8n.yourdomain.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=false
N8N_BASE_URL=https://n8n.yourdomain.com
WEBHOOK_PATH=/webhook/ios-sms
GENERIC_TIMEZONE=Asia/Kolkata
PLAYWRIGHT_HOST_PORT=3010
TZ=Asia/Kolkata
NODE_ENV=production
```

### 3️⃣ Configure Domain (2 min)
```
Domains → Add Domain
→ Domain: n8n.yourdomain.com
→ Service: n8n
→ Port: 5678
→ Enable SSL (Let's Encrypt)
```

### 4️⃣ Deploy (2 min)
```
Click "Deploy" → Wait 5-8 minutes → Check containers are healthy ✅
```

### 5️⃣ Import Workflow (1 min)
```
Open https://n8n.yourdomain.com
→ Create account
→ Workflows → Import from File
→ Select n8n-otp-voucher-workflow.json
→ Activate workflow ✅
```

---

## ✅ Quick Verification

```bash
# 1. Test n8n health
curl https://n8n.yourdomain.com/healthz
# Should return: {"status":"ok"}

# 2. Test webhook
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Test OTP is 123456"}'
# Should return: {"status":"received","success":true,"mobile_otp":"123456"}

# 3. Check containers
docker ps | grep -E 'n8n|playwright'
# Should show 2 healthy containers
```

---

## 📱 iOS Shortcut Setup

1. **Shortcuts app** → Automation → When I receive a message
2. **Add action** → Get Contents of URL:
   - URL: `https://n8n.yourdomain.com/webhook/ios-sms`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body: `{"message": "[Message Content]"}`
3. **Disable** "Ask Before Running"
4. **Save**

Test: Send yourself "OTP is 123456"

---

## 🔧 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| **n8n not accessible** | Check DNS: `dig n8n.yourdomain.com` |
| **Containers not starting** | Check logs: `docker logs n8n` |
| **Webhook 404** | Activate workflow in n8n dashboard |
| **OTP timeout** | Verify iOS Shortcut automation enabled |
| **Service communication error** | Both services on same network? Check docker-compose.yml |

---

## 📊 Health Check Commands

```bash
# Container status
docker ps | grep -E 'n8n|playwright'

# n8n logs
docker logs -f n8n

# Playwright logs
docker logs -f playwright-service

# Health endpoints
curl https://n8n.yourdomain.com/healthz
curl http://YOUR_SERVER_IP:3010/health

# Resource usage
docker stats --no-stream
```

---

## 🎯 Success Criteria

- ✅ n8n accessible at https://n8n.yourdomain.com
- ✅ Both containers healthy
- ✅ Webhook returns parsed OTP
- ✅ iOS Shortcut delivers messages
- ✅ Workflow executes successfully

---

## 📚 Full Documentation

Need more details? See:
- **Step-by-step guide**: `DOKPLOY_DEPLOY_STEPS.md`
- **Detailed deployment**: `DEPLOYMENT.md`
- **Quick reference**: `QUICK_REFERENCE.md`
- **Full checklist**: `DEPLOYMENT_CHECKLIST.md`

---

## 🆘 Still Stuck?

1. Check full logs: `docker logs n8n && docker logs playwright-service`
2. Verify all environment variables set correctly
3. Test each component individually
4. Review [GitHub Issues](https://github.com/bluebox/automate_vouchers/issues)

---

⚡ **Total Time**: 10 minutes + 5-8 min build time = ~15-18 minutes

🎉 **You're done!** Now test with a real purchase!
