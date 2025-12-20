# 🚀 Dokploy Final Setup - Fix 404 Issue

## ✅ What We Just Fixed

Added **Traefik labels** to `docker-compose.yml` so Dokploy's Traefik can route traffic to your n8n container.

## 🔧 Steps to Complete (Do This Now!)

### 1. In Dokploy UI → Your n8n Application → Environment Variables

**CRITICAL**: Add this environment variable (if not already set):

```bash
N8N_HOST=n8n.harshit.cloud
```

**Full list of required variables:**

```bash
# AmEx Gyftr Credentials (REQUIRED)
MOBILE=your_mobile_number
EMAIL=your_email@example.com
CARD_CVV=123
GOLD_CHARGE_CVV=456
GOLD_CHARGE=false

# n8n Configuration (REQUIRED)
N8N_HOST=n8n.harshit.cloud
N8N_BASE_URL=https://n8n.harshit.cloud
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=true
N8N_PORT=5678

# Other settings
WEBHOOK_PATH=/webhook/ios-sms
GENERIC_TIMEZONE=Asia/Kolkata
TZ=Asia/Kolkata

# Swiggy (OPTIONAL - only if you want auto-claim)
SWIGGY_VOUCHER_CLAIM_URL=https://chkout.swiggy.com/swiggymoney/voucher/claim
SWIGGY_DEVICE_ID=your_device_id
SWIGGY_TID=your_tid
SWIGGY_TOKEN=your_token
```

### 2. Redeploy Your Application

In Dokploy:
1. Go to your **n8n application**
2. Click **"Redeploy"** or **"Deploy"** button
3. Wait for deployment to complete (should be faster this time as image is cached)

### 3. Wait 30-60 seconds

Give Traefik time to:
- Detect the new labels
- Request Let's Encrypt SSL certificate
- Configure routing rules

### 4. Test the Deployment

```bash
# Test 1: Check if n8n is accessible
curl -I https://n8n.harshit.cloud

# Should return: HTTP/2 200 (not 404)

# Test 2: Check n8n healthz endpoint
curl https://n8n.harshit.cloud/healthz

# Should return: {"status":"ok"}
```

### 5. Access n8n Web UI

Open: **https://n8n.harshit.cloud**

You should see:
- n8n login/setup page (first time)
- OR your existing n8n dashboard

## 🐛 If Still Getting 404

### Check 1: Verify Environment Variables
```bash
# In Dokploy, check if N8N_HOST is set correctly
# It MUST match your domain exactly
```

### Check 2: Check Container Logs
In Dokploy UI:
1. Go to your n8n app → **Monitoring** → **Logs**
2. Select `n8n` container
3. Look for errors

### Check 3: Verify Traefik Can See Your Service
```bash
# SSH into your Dokploy server
docker logs dokploy-traefik 2>&1 | grep n8n

# Should show Traefik detected your n8n service
```

### Check 4: Verify Containers Are Running
```bash
# SSH into your Dokploy server
docker ps | grep n8n

# Should show both containers as "healthy"
```

## 📊 Success Indicators

✅ `curl https://n8n.harshit.cloud` returns HTML (not 404)  
✅ Browser shows n8n UI at `https://n8n.harshit.cloud`  
✅ SSL certificate is valid (green lock in browser)  
✅ Both containers show as "healthy" in Dokploy  

## 🆘 Still Need Help?

If you're still getting 404 after:
1. Setting `N8N_HOST=n8n.harshit.cloud` in environment variables
2. Redeploying the application
3. Waiting 60 seconds

Then share:
- Container logs from Dokploy UI
- Output of: `docker logs dokploy-traefik 2>&1 | tail -50`
- Screenshot of your environment variables in Dokploy

---

**Next Step**: After n8n is accessible, import the workflow from `n8n-otp-voucher-workflow.json`

