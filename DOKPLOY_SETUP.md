# 🚀 Quick Dokploy Setup Guide

This is a streamlined guide for deploying on Dokploy in under 10 minutes.

## 📋 Prerequisites Checklist

- [ ] Dokploy instance running
- [ ] Domain name configured
- [ ] GitHub repository access
- [ ] AmEx Gyftr credentials ready
- [ ] (Optional) Swiggy API credentials for auto-claim

## ⚡ Quick Deploy Steps

### Step 1: Create Application (2 mins)

1. Login to Dokploy dashboard
2. Click **"+ Create Application"**
3. Select **"Docker Compose"**
4. Connect your GitHub repository
5. Select branch (usually `main`)

### Step 2: Set Environment Variables (3 mins)

Copy this template and fill in your values:

```env
# Required - AmEx Gyftr
MOBILE=9876543210
EMAIL=your.email@example.com
CARD_CVV=123
GOLD_CHARGE_CVV=456
GOLD_CHARGE=false

# Required - n8n
N8N_HOST=n8n.yourdomain.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=false
N8N_BASE_URL=https://n8n.yourdomain.com
WEBHOOK_PATH=/webhook/ios-sms
GENERIC_TIMEZONE=Asia/Kolkata

# Optional - Swiggy Auto-Claim
SWIGGY_VOUCHER_CLAIM_URL=https://chkout.swiggy.com/swiggymoney/voucher/claim
SWIGGY_DEVICE_ID=
SWIGGY_TID=
SWIGGY_TOKEN=

# System
PLAYWRIGHT_HOST_PORT=3010
TZ=Asia/Kolkata
```

### Step 3: Configure Domain (2 mins)

1. Go to **Domains** tab in your application
2. Add domain: `n8n.yourdomain.com`
3. Enable **SSL/TLS** (Let's Encrypt)
4. Point to service: `n8n`
5. Port: `5678`

### Step 4: Deploy (2 mins)

1. Click **"Deploy"** button
2. Wait for build to complete (~3-5 minutes)
3. Check logs for any errors
4. Verify health checks are passing ✅

### Step 5: Import Workflow (1 min)

1. Access n8n: `https://n8n.yourdomain.com`
2. Create account/login
3. Go to **Workflows** → **Import from File**
4. Upload `n8n-otp-voucher-workflow.json`
5. Click **Activate** ✅

## 🧪 Testing

### Test 1: Health Checks
```bash
# Test n8n
curl https://n8n.yourdomain.com/healthz

# Test playwright (if exposed)
curl http://your-server:3010/health
```

### Test 2: Webhook
```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "OTP is 123456"}'
```

Expected response:
```json
{
  "status": "received",
  "success": true,
  "content_type": "mobile_otp",
  "mobile_otp": "123456"
}
```

### Test 3: Playwright Service
```bash
curl -X POST http://your-server:3010/start \
  -H "Content-Type: application/json" \
  -d '{"goldCharge": false}'
```

## 📱 iOS Shortcut Setup

### Quick Setup:
1. Open Shortcuts app on iPhone
2. Create new Shortcut
3. Add action: **"When I receive a text message"**
4. Add action: **"Get contents of URL"**
   - URL: `https://n8n.yourdomain.com/webhook/ios-sms`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Request Body: JSON
   ```json
   {
     "message": "<Message Content>"
   }
   ```
5. Save and test by sending yourself a test SMS

## 🔍 Troubleshooting

### Problem: Services Not Starting
**Check:**
```bash
docker ps
docker logs n8n
docker logs playwright-service
```

**Solution:**
- Verify all environment variables are set
- Check if ports are not already in use
- Ensure sufficient memory (min 2GB)

### Problem: Webhook Not Receiving Data
**Check:**
1. Webhook URL is correct
2. Domain SSL is working
3. n8n workflow is active

**Test manually:**
```bash
curl -v https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### Problem: Playwright Automation Fails
**Common causes:**
- Wrong credentials
- OTP timeout (increase wait time)
- Missing browser dependencies

**Check logs:**
```bash
docker logs -f playwright-service
```

### Problem: Services Can't Communicate
**Solution:**
- Both services must be on same Docker network (✅ already configured)
- Use internal URLs: `http://n8n:5678` and `http://playwright-service:3000`
- Don't use public domains for internal communication

## 📊 Monitoring

### Service Status
```bash
# In Dokploy dashboard
Application → Logs → Select service
```

### Quick Commands
```bash
# Restart services
docker restart n8n playwright-service

# View recent logs
docker logs --tail 50 n8n
docker logs --tail 50 playwright-service

# Check resource usage
docker stats
```

## 🔒 Security Checklist

- [ ] Environment variables are set in Dokploy (not committed to repo)
- [ ] n8n is accessible only via HTTPS
- [ ] Playwright service is NOT exposed externally (only n8n)
- [ ] Strong credentials for n8n dashboard
- [ ] Regular credential rotation for Swiggy tokens

## 🎯 Next Steps

After deployment:

1. **Test the full flow:**
   - Trigger automation via n8n
   - Send test OTP via iOS Shortcut
   - Verify voucher purchase completes

2. **Monitor for issues:**
   - Check logs daily for first week
   - Verify OTP polling works
   - Test Swiggy auto-claim

3. **Optimize:**
   - Adjust OTP polling intervals if needed
   - Fine-tune timeouts
   - Add monitoring/alerts

## 📞 Support

- **Logs:** Check Dokploy dashboard → Logs
- **Issues:** [GitHub Issues](https://github.com/bluebox/automate_vouchers/issues)
- **Docs:** See `DEPLOYMENT.md` for detailed guide

---

✅ **Deployment Complete!** Your voucher automation system is ready to use.

Test it by triggering a purchase through the n8n workflow and sending OTPs via your iOS Shortcut.





