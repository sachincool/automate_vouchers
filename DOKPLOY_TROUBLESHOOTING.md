# 🔧 Dokploy Deployment Troubleshooting Guide

Quick solutions to common deployment issues.

---

## 🚨 Deployment Issues

### ❌ Build Failed

**Symptoms:**
- Build logs show errors
- Containers not created
- Deployment status: Failed

**Diagnosis:**
```bash
# Check build logs in Dokploy dashboard
Logs → Select build phase → Look for error messages
```

**Common Causes & Solutions:**

| Error Message | Solution |
|--------------|----------|
| `Cannot find package.json` | Ensure repo has `package.json` in root |
| `npm install failed` | Check package versions, try `npm ci` instead |
| `Dockerfile not found` | Check `Dockerfile.playwright` exists |
| `Context build failed` | Verify all files committed and pushed |
| `Out of disk space` | Clean up old images: `docker system prune -a` |

### ❌ Containers Not Starting

**Symptoms:**
- Build succeeds but containers exit immediately
- Status shows "Exited" or "Error"

**Diagnosis:**
```bash
# SSH to server and check logs
docker logs n8n
docker logs playwright-service

# Check why container exited
docker ps -a | grep -E 'n8n|playwright'
```

**Solutions:**

1. **Missing environment variables:**
   ```bash
   # Check if vars are set
   docker exec n8n env | grep N8N_HOST
   ```
   Fix: Add missing vars in Dokploy Settings → Environment

2. **Port conflicts:**
   ```bash
   # Check if ports are in use
   netstat -tuln | grep -E '5678|3010'
   ```
   Fix: Change ports in environment variables

3. **Memory issues:**
   ```bash
   # Check available memory
   free -h
   ```
   Fix: Increase server memory or limit container resources

4. **Permission issues:**
   ```bash
   # Check volume permissions
   docker exec n8n ls -la /home/node/.n8n
   ```
   Fix: Adjust volume mount permissions

---

## 🌐 Network & Domain Issues

### ❌ n8n Not Accessible

**Symptoms:**
- Browser shows "Cannot connect" or "ERR_CONNECTION_REFUSED"
- `curl https://n8n.yourdomain.com` fails

**Step-by-step diagnosis:**

```bash
# 1. Check DNS resolution
dig n8n.yourdomain.com
# Should return your Dokploy server IP

# 2. Check if n8n is running
docker ps | grep n8n
# Should show "Up" status

# 3. Check if port is listening
netstat -tuln | grep 5678
# Should show LISTEN on 0.0.0.0:5678

# 4. Check if you can reach locally
curl -v http://localhost:5678/healthz
# Should return 200 OK

# 5. Check SSL certificate
curl -v https://n8n.yourdomain.com/healthz
# Should not show SSL errors
```

**Solutions:**

| Issue | Fix |
|-------|-----|
| DNS doesn't resolve | Update DNS A record to point to server IP, wait for propagation |
| Container not running | Check logs: `docker logs n8n` |
| Port not listening | Ensure docker-compose.yml exposes port 5678 |
| SSL certificate error | Regenerate in Dokploy: Domains → Delete → Re-add domain |
| Firewall blocking | Open ports: `ufw allow 80/tcp && ufw allow 443/tcp` |

### ❌ Webhook Returns 404

**Symptoms:**
- `curl https://n8n.yourdomain.com/webhook/ios-sms` returns 404
- iOS Shortcut receives error

**Diagnosis:**
1. Open n8n dashboard: `https://n8n.yourdomain.com`
2. Go to Workflows
3. Check if workflow is **Active** (green toggle)
4. Open workflow and verify webhook node

**Solutions:**
- **Workflow not active**: Toggle to Active
- **Wrong webhook path**: Verify webhook URL in workflow matches environment variable
- **n8n not fully started**: Wait 2-3 minutes after deployment, then retry
- **Webhook node misconfigured**: Check webhook node settings match: `/webhook/ios-sms`

---

## 🤖 Playwright Service Issues

### ❌ Playwright Service Unhealthy

**Symptoms:**
- Container shows "Unhealthy" status
- Health check failing

**Diagnosis:**
```bash
# Check health endpoint
curl http://localhost:3010/health

# Check container logs
docker logs playwright-service --tail 50

# Check if Chromium installed
docker exec playwright-service npx playwright --version
```

**Solutions:**

1. **Chromium not installed:**
   ```bash
   # Rebuild container to reinstall browsers
   docker-compose down
   docker-compose up --build -d
   ```

2. **Insufficient shared memory:**
   Check `docker-compose.yml` has `shm_size: '1gb'`

3. **Missing dependencies:**
   ```bash
   # Check Dockerfile.playwright includes:
   RUN npx playwright install chromium --with-deps
   ```

### ❌ Playwright Can't Reach n8n

**Symptoms:**
- Playwright automation fails with "connection refused"
- Logs show: "Failed to retrieve OTP"

**Diagnosis:**
```bash
# Test from playwright container
docker exec playwright-service curl http://n8n:5678/healthz

# Check if both on same network
docker network inspect voucher-network
```

**Solutions:**

1. **Wrong n8n URL in environment:**
   ```bash
   # In Dokploy, check environment variable:
   N8N_BASE_URL=http://n8n:5678  # Use internal URL, not public domain!
   ```

2. **Network not configured:**
   Check `docker-compose.yml` has both services on `voucher-network`

3. **n8n not ready:**
   Add `depends_on` in docker-compose.yml (already configured)

### ❌ Automation Times Out

**Symptoms:**
- Playwright runs but fails with "OTP timeout"
- Logs show: "Failed to retrieve mobile_otp after X retries"

**Diagnosis:**
```bash
# Check if OTPs are being received
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Test OTP is 123456"}'

# Check state retrieval
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "__GET_STATE__"}'
```

**Solutions:**

1. **iOS Shortcut not configured:**
   - Verify Shortcut automation is enabled
   - Check "Ask Before Running" is OFF
   - Test by sending yourself an SMS

2. **OTP expired:**
   - OTPs expire after 40 seconds
   - Send OTP within 5-10 seconds of request

3. **Polling interval too long:**
   In `server.js`, adjust:
   ```javascript
   const POLLING_INTERVAL = 5000  // Reduce to 3000 for faster polling
   const MAX_RETRIES = 5          // Increase for longer wait
   ```

4. **Network latency:**
   Increase timeout in `server.js`:
   ```javascript
   const mobileOtp = await getOTPFromWebhook('mobile_otp', 180000)  // 3 minutes
   ```

---

## 📱 iOS Shortcut Issues

### ❌ Shortcut Not Running Automatically

**Symptoms:**
- Receive SMS but shortcut doesn't trigger
- No data appears in n8n

**Solutions:**

1. **"Ask Before Running" is enabled:**
   - Automation → Select your automation
   - Toggle OFF "Ask Before Running"

2. **Automation not enabled:**
   - Automation → Check toggle is green/enabled

3. **Focus mode blocking:**
   - Settings → Focus → Check automation exceptions

4. **iOS permissions:**
   - Settings → Shortcuts → Allow Running Scripts
   - Settings → Shortcuts → Allow Sharing Data

### ❌ Shortcut Runs But Data Not Received

**Diagnosis:**
```bash
# Test webhook manually
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Test OTP 123456"}'
```

**Solutions:**

1. **Wrong webhook URL:**
   Verify URL in Shortcut matches: `https://n8n.yourdomain.com/webhook/ios-sms`

2. **Wrong HTTP method:**
   Must be POST, not GET

3. **Wrong body format:**
   Should be JSON: `{"message": "[Message Content]"}`
   Use variable picker to insert `Message Content`

4. **Missing Content-Type header:**
   Add header: `Content-Type: application/json`

---

## 🔐 SSL/TLS Issues

### ❌ SSL Certificate Not Generating

**Symptoms:**
- HTTPS doesn't work
- Browser shows "Not Secure" or "Certificate Error"

**Diagnosis:**
```bash
# Test SSL certificate
openssl s_client -connect n8n.yourdomain.com:443 -servername n8n.yourdomain.com

# Check Let's Encrypt logs in Dokploy
```

**Solutions:**

1. **DNS not propagated:**
   ```bash
   # Check DNS from multiple locations
   dig n8n.yourdomain.com @8.8.8.8
   dig n8n.yourdomain.com @1.1.1.1
   ```
   Wait 5-15 minutes for DNS propagation

2. **Rate limit reached:**
   Let's Encrypt has rate limits (5 certs per domain per week)
   Wait and try again later

3. **Port 80/443 not open:**
   ```bash
   # Open firewall ports
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```

4. **Domain not pointing to server:**
   Verify A record points to correct IP

---

## 💾 Volume & Data Issues

### ❌ n8n Workflows Lost After Restart

**Symptoms:**
- Imported workflows disappear after container restart
- Settings not persisting

**Diagnosis:**
```bash
# Check if volume exists
docker volume ls | grep n8n_data

# Inspect volume
docker volume inspect n8n_data
```

**Solution:**
Volume should be defined in `docker-compose.yml`:
```yaml
volumes:
  n8n_data:
    driver: local
```

And mounted:
```yaml
services:
  n8n:
    volumes:
      - n8n_data:/home/node/.n8n
```

### ❌ Screenshots Not Saved

**Symptoms:**
- Screenshots directory empty
- Debugging difficult

**Solution:**
Check `docker-compose.yml` has playwright volume:
```yaml
volumes:
  playwright_data:
    driver: local

services:
  playwright-service:
    volumes:
      - playwright_data:/app/screenshots
```

---

## 🔍 Debugging Tools

### Essential Commands

```bash
# 1. Container status
docker ps -a | grep -E 'n8n|playwright'

# 2. Real-time logs
docker logs -f n8n
docker logs -f playwright-service

# 3. Inspect container
docker inspect n8n | jq '.[0].State'

# 4. Execute commands in container
docker exec -it n8n /bin/sh
docker exec -it playwright-service /bin/bash

# 5. Check environment variables
docker exec n8n env
docker exec playwright-service env

# 6. Resource usage
docker stats --no-stream

# 7. Network connectivity
docker exec playwright-service ping -c 3 n8n
docker exec playwright-service curl http://n8n:5678/healthz

# 8. Volume data
docker volume inspect n8n_data
docker exec n8n ls -la /home/node/.n8n
```

### Log Analysis

```bash
# Filter for errors
docker logs n8n 2>&1 | grep -i error

# Filter for specific time range
docker logs --since 30m n8n

# Save logs to file
docker logs n8n > n8n-logs.txt 2>&1
```

---

## 🆘 Still Not Working?

### Step-by-Step Debugging Process

1. **Verify basics:**
   ```bash
   # Server has enough resources?
   free -h && df -h
   
   # Docker is running?
   systemctl status docker
   
   # Containers exist?
   docker ps -a
   ```

2. **Check each component:**
   ```bash
   # n8n accessible?
   curl http://localhost:5678/healthz
   
   # Playwright accessible?
   curl http://localhost:3000/health
   
   # Webhook works?
   curl -X POST http://localhost:5678/webhook/ios-sms \
     -H "Content-Type: application/json" \
     -d '{"message": "test"}'
   ```

3. **Test integration:**
   ```bash
   # Can playwright reach n8n?
   docker exec playwright-service curl http://n8n:5678/healthz
   
   # Test full flow
   curl -X POST http://localhost:3000/start \
     -H "Content-Type: application/json" \
     -d '{"goldCharge": false}'
   ```

4. **Collect information:**
   ```bash
   # System info
   uname -a
   docker --version
   docker-compose --version
   
   # Container logs
   docker logs n8n > n8n.log 2>&1
   docker logs playwright-service > playwright.log 2>&1
   
   # Environment
   docker exec n8n env > n8n-env.txt
   docker exec playwright-service env > playwright-env.txt
   ```

5. **Create GitHub issue:**
   - Include logs
   - Include steps to reproduce
   - Include environment info
   - [Create Issue](https://github.com/bluebox/automate_vouchers/issues)

---

## 📚 Additional Resources

- **Detailed deployment**: `DOKPLOY_DEPLOY_STEPS.md`
- **Quick start**: `DOKPLOY_QUICKSTART.md`
- **Full checklist**: `DEPLOYMENT_CHECKLIST.md`
- **Architecture**: `ARCHITECTURE.md`

---

## 🎯 Prevention Tips

1. **Always check logs first:**
   ```bash
   docker logs n8n --tail 100
   docker logs playwright-service --tail 100
   ```

2. **Verify environment variables:**
   Before deploying, double-check all required vars are set

3. **Test incrementally:**
   - Test n8n first (without playwright)
   - Then test webhook
   - Finally test full automation

4. **Monitor resources:**
   ```bash
   # Check every few hours
   docker stats --no-stream
   ```

5. **Keep backups:**
   ```bash
   # Export workflows regularly
   # Save environment variable list
   # Document any custom changes
   ```

---

**Troubleshooting Guide Version:** 1.0  
**Last Updated:** December 20, 2025

💡 **Pro Tip:** Most issues are environment variable or network-related. Check those first!
