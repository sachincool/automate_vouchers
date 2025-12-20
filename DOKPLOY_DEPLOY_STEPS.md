# 🚀 Dokploy Deployment - Step by Step

Complete guide to deploy your voucher automation system on Dokploy.

## 📋 Before You Start

**Have These Ready:**


- [ ] Dokploy instance URL
- [ ] Your domain name (e.g., `yourdomain.com`)
- [ ] GitHub repository access
- [ ] AmEx Gyftr credentials (mobile, email, CVVs)
- [ ] (Optional) Swiggy API credentials

---

## Step 1: Prepare Your Repository

### 1.1 Commit Your Changes

```bash
cd /Users/bluebox/projects/automate_vouchers

# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Ready for Dokploy deployment"

# Push to main branch
git push origin main
```

---

## Step 2: Create Application in Dokploy


### 2.1 Login to Dokploy Dashboard

1. Navigate to your Dokploy instance URL
2. Login with your credentials


### 2.2 Create New Application

1. Click **"Create Application"** or **"+ New App"**
2. Fill in the details:
   - **Name**: `voucher-automation` (or any name you prefer)
   - **Type**: Select **"Docker Compose"**

3. Click **"Next"** or **"Continue"**

### 2.3 Connect GitHub Repository

1. Select **"GitHub"** as the source
2. If first time:
   - Click **"Connect GitHub"**
   - Authorize Dokploy to access your repositories
3. Select your repository: `bluebox/automate_vouchers`
4. Select branch: `main` (or your default branch)
5. **Build path**: `/` (root)
6. **Compose file**: `docker-compose.yml` (should auto-detect)

---


## Step 3: Configure Environment Variables

### 3.1 Navigate to Environment Variables

- In your application, go to **"Settings"** → **"Environment Variables"**
- Or look for **"Environment"** or **"Env Vars"** tab

### 3.2 Add Required Variables

Copy and paste these variables **ONE BY ONE**, replacing with your actual values:

```env
# AmEx Gyftr Credentials
MOBILE=9876543210
EMAIL=your.email@example.com
CARD_CVV=123
GOLD_CHARGE_CVV=456
GOLD_CHARGE=false

# n8n Configuration
N8N_HOST=n8n.yourdomain.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=false
N8N_BASE_URL=https://n8n.yourdomain.com
WEBHOOK_PATH=/webhook/ios-sms
GENERIC_TIMEZONE=Asia/Kolkata

# System Configuration
PLAYWRIGHT_HOST_PORT=3010
TZ=Asia/Kolkata
NODE_ENV=production
```

### 3.3 Add Optional Swiggy Variables (if using auto-claim)

```env
SWIGGY_VOUCHER_CLAIM_URL=https://chkout.swiggy.com/swiggymoney/voucher/claim
SWIGGY_DEVICE_ID=your_device_id_here
SWIGGY_TID=your_tid_here
SWIGGY_TOKEN=your_token_here
```

> **⚠️ Important:** Replace `yourdomain.com` with your actual domain!


---

## Step 4: Configure Domain & SSL

### 4.1 Add Domain

1. Go to **"Domains"** tab in your application
2. Click **"Add Domain"**

3. Enter your domain: `n8n.yourdomain.com`
4. **Service**: Select `n8n`
5. **Port**: `5678`
6. **Path**: `/` (root)


### 4.2 Enable SSL/TLS

1. Toggle **"Enable SSL"** or **"HTTPS"**
2. Select **"Let's Encrypt"** (automatic certificate)
3. Wait for certificate generation (~1-2 minutes)

### 4.3 Update DNS

Before deploying, make sure your DNS is configured:


```bash
# Check DNS resolution
dig n8n.yourdomain.com

# Should point to your Dokploy server IP
```

**DNS Settings** (in your domain registrar):

- **Type**: `A Record`

- **Name**: `n8n` (or `@` for root domain)
- **Value**: Your Dokploy server IP address
- **TTL**: `3600` (or default)

---

## Step 5: Deploy the Application

### 5.1 Start Deployment



1. Click **"Deploy"** button (usually in top-right)
2. Watch the build logs
3. Wait for:
   - ✅ Build complete
   - ✅ Images pulled/built
   - ✅ Containers started
   - ✅ Health checks passing

### 5.2 Monitor Build Progress

The build process will:

1. Clone your repository ✅
2. Build `playwright-service` container (~3-5 minutes)

3. Pull `n8n` image (~1-2 minutes)

4. Start both containers
5. Run health checks
6. Mark as healthy ✅

**Expected build time:** 5-8 minutes

---

## Step 6: Verify Deployment

### 6.1 Check Container Status


In Dokploy dashboard:

- Go to **"Containers"** or **"Services"** tab
- Verify both containers are running:
  - ✅ `n8n` - Status: Healthy
  - ✅ `playwright-service` - Status: Healthy

### 6.2 Test n8n Health Endpoint

```bash
curl https://n8n.yourdomain.com/healthz
```

**Expected response:**


```json
{
  "status": "ok"
}
```

### 6.3 Test Playwright Service

```bash

# If exposed (via PLAYWRIGHT_HOST_PORT)
curl http://your-dokploy-server-ip:3010/health
```

**Expected response:**

```json
{
  "status": "healthy",
  "service": "playwright-automation",
  "isRunning": false,
  "timestamp": "2025-12-20T..."
}

```

### 6.4 Access n8n Dashboard

1. Open browser: `https://n8n.yourdomain.com`
2. Should see n8n setup page

3. Create your account:
   - **Email**: your email
   - **Password**: strong password
   - **First name**: your name
   - **Last name**: your name


---

## Step 7: Import n8n Workflow

### 7.1 Import Workflow File

1. In n8n dashboard, click **"Workflows"** in left sidebar
2. Click **"Import from File"** button (top-right)
3. Select `n8n-otp-voucher-workflow.json` from your local copy
4. Click **"Import"**

### 7.2 Verify Workflow

1. Open the imported workflow
2. Check all nodes are connected properly
3. Look for any errors (red triangles)
4. Verify environment variables are accessible


### 7.3 Activate Workflow

1. Click the **"Inactive"** toggle at top-right
2. Should turn to **"Active"** (green)
3. Workflow is now live! ✅

---

## Step 8: Test the System

### 8.1 Test Webhook Endpoint

```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Your OTP is 123456"}'
```

**Expected response:**

```json
{
  "status": "received",
  "success": true,
  "content_type": "mobile_otp",
  "mobile_otp": "123456",
  "expires_at": "2025-12-20T12:35:00.000Z"
}
```

### 8.2 Test State Retrieval

```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "__GET_STATE__", "type": "status_check"}'
```

### 8.3 Test Playwright Automation


```bash
# Trigger a test run (this will actually try to purchase!)
curl -X POST http://your-dokploy-ip:3010/start \
  -H "Content-Type: application/json" \
  -d '{"goldCharge": false}'

```

> ⚠️ **Warning:** This will attempt a real purchase. Only test when ready!

---

## Step 9: Configure iOS Shortcut

### 9.1 Create Automation in iOS Shortcuts


1. Open **Shortcuts** app on iPhone
2. Go to **"Automation"** tab
3. Click **"+"** to create new automation
4. Select **"When I receive a message"**


### 9.2 Configure Message Trigger


- **Sender**: Keep empty (any sender)
- **Message Contains**: Keep empty (any message)
- Click **"Next"**

### 9.3 Add Webhook Action


1. Search for **"Get Contents of URL"**

2. Configure:
   - **URL**: `https://n8n.yourdomain.com/webhook/ios-sms`
   - **Method**: `POST`
   - **Headers**:
     - Key: `Content-Type`
     - Value: `application/json`
   - **Request Body**: `JSON`
   - **JSON Body**:


     ```json
     {
       "message": "{{Message Content}}"
     }
     ```


     (Use the variable picker to insert `Message Content`)

### 9.4 Finalize Automation

- Click **"Next"**
- Toggle OFF **"Ask Before Running"** (important!)

- Toggle ON **"Notify When Run"** (optional, for debugging)
- Click **"Done"**


### 9.5 Test iOS Shortcut

Send yourself a test SMS with "OTP is 123456" and check:

- ✅ Shortcut runs automatically

- ✅ n8n receives the webhook
- ✅ OTP is parsed correctly

---

## Step 10: Monitor & Maintain

### 10.1 View Logs in Dokploy

- Go to **"Logs"** tab
- Select service: `n8n` or `playwright-service`

- Monitor for errors

### 10.2 Check n8n Executions

- In n8n dashboard, go to **"Executions"**
- View history of all workflow runs
- Check for failed executions

### 10.3 Regular Maintenance Tasks

**Daily:**

- Check execution logs for errors


**Weekly:**

- Review failed executions
- Test end-to-end flow
- Verify OTP polling works


**Monthly:**

- Update dependencies
- Review and rotate credentials
- Check for Playwright updates

---


## 🔧 Troubleshooting

### Issue: Containers Not Starting

**Check:**

```bash

# SSH into Dokploy server
ssh user@your-dokploy-server

# Check container logs

docker logs n8n
docker logs playwright-service

# Check container status
docker ps -a | grep -E 'n8n|playwright'
```


**Common causes:**

- Missing environment variables
- Port conflicts
- Insufficient memory (need 2GB+ for Playwright)


### Issue: n8n Not Accessible

**Check:**

1. DNS resolves correctly: `dig n8n.yourdomain.com`
2. SSL certificate generated: Check Dokploy Domains tab
3. Port 5678 is exposed: Check docker-compose.yml
4. Container is healthy: Check Dokploy dashboard

### Issue: Webhook Returns 404

**Check:**

1. Workflow is activated in n8n
2. Webhook path matches: `/webhook/ios-sms`
3. n8n is running: `curl https://n8n.yourdomain.com/healthz`

### Issue: Playwright Service Can't Reach n8n

**Check:**

1. Both containers on same network: `voucher-network`
2. Using internal URL: `http://n8n:5678` (not public domain)
3. n8n container is healthy
4. Test from playwright container:

   ```bash
   docker exec playwright-service curl http://n8n:5678/healthz
   ```

### Issue: OTP Polling Timeout

**Possible causes:**

1. iOS Shortcut not configured correctly
2. Shortcut not running automatically
3. OTP expired (40-second window)
4. Network latency

**Solutions:**

- Increase polling intervals in `server.js`
- Verify iOS Shortcut automation is enabled
- Check n8n webhook logs

---

## 📊 Success Metrics

Your deployment is successful when:

- ✅ Both containers are healthy
- ✅ n8n dashboard accessible via HTTPS
- ✅ Webhook endpoint responds correctly
- ✅ iOS Shortcut delivers OTPs to n8n
- ✅ Playwright automation completes purchases
- ✅ Vouchers are received and auto-claimed

---

## 🎯 Next Steps

1. **Test End-to-End Flow**
   - Trigger a real purchase
   - Send OTPs via iOS Shortcut
   - Verify voucher is received

2. **Set Up Monitoring**
   - Configure alerts for failures
   - Set up log aggregation
   - Monitor resource usage

3. **Optimize Performance**
   - Adjust polling intervals
   - Fine-tune timeouts
   - Review logs for bottlenecks

4. **Document Custom Changes**
   - Note any modifications
   - Update README if needed
   - Share learnings with team

---

## 📞 Support Resources

- **Documentation**: See `DEPLOYMENT.md` for detailed info
- **Quick Reference**: See `QUICK_REFERENCE.md` for commands
- **Checklist**: See `DEPLOYMENT_CHECKLIST.md` for verification
- **Issues**: [GitHub Issues](https://github.com/bluebox/automate_vouchers/issues)

---

**Deployment Guide Version:** 1.0  
**Last Updated:** December 20, 2025  
**Estimated Time:** 20-30 minutes  

✅ **You're ready to deploy!**
