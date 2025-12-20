# 📋 Deployment Checklist

Use this checklist to ensure a smooth deployment to Dokploy.

## Pre-Deployment

### Local Preparation
- [ ] Git repository is up to date
- [ ] All code changes are committed
- [ ] `.env` file created from `example.env`
- [ ] All required environment variables filled in
- [ ] Run `npm run validate` - passes ✅
- [ ] `.env` is in `.gitignore` (never commit secrets!)

### Credentials Ready
- [ ] AmEx Gyftr mobile number
- [ ] AmEx Gyftr email address
- [ ] Card CVV (and Gold Charge CVV if applicable)
- [ ] (Optional) Swiggy Device ID
- [ ] (Optional) Swiggy TID
- [ ] (Optional) Swiggy Token

### Domain Setup
- [ ] Domain name registered
- [ ] DNS pointing to Dokploy server
- [ ] Subdomain for n8n (e.g., `n8n.yourdomain.com`)

## Dokploy Setup

### Application Creation
- [ ] Logged into Dokploy dashboard
- [ ] Clicked "Create Application"
- [ ] Selected "Docker Compose" type
- [ ] Connected GitHub repository
- [ ] Selected correct branch (usually `main`)

### Environment Variables
Copy these variables to Dokploy:

#### Required Variables
- [ ] `MOBILE` - Your mobile number
- [ ] `EMAIL` - Your email address
- [ ] `CARD_CVV` - Your card CVV
- [ ] `N8N_HOST` - Your n8n domain
- [ ] `N8N_BASE_URL` - Full n8n URL with https://
- [ ] `N8N_PORT` - 5678
- [ ] `N8N_PROTOCOL` - https
- [ ] `N8N_SECURE_COOKIE` - false
- [ ] `WEBHOOK_PATH` - /webhook/ios-sms
- [ ] `GENERIC_TIMEZONE` - Asia/Kolkata

#### Optional Variables
- [ ] `GOLD_CHARGE` - true/false
- [ ] `GOLD_CHARGE_CVV` - If using Gold Charge
- [ ] `SWIGGY_VOUCHER_CLAIM_URL` - Swiggy API URL
- [ ] `SWIGGY_DEVICE_ID` - Your device ID
- [ ] `SWIGGY_TID` - Your TID
- [ ] `SWIGGY_TOKEN` - Your Swiggy token
- [ ] `PLAYWRIGHT_HOST_PORT` - 3010
- [ ] `TZ` - Asia/Kolkata

### Domain Configuration
- [ ] Added domain in Dokploy
- [ ] Domain: `n8n.yourdomain.com`
- [ ] SSL/TLS enabled (Let's Encrypt)
- [ ] Points to service: `n8n`
- [ ] Port: `5678`
- [ ] Health check enabled

### Build & Deploy
- [ ] Clicked "Deploy" button
- [ ] Build started successfully
- [ ] Build completed without errors
- [ ] Both containers started
- [ ] Health checks passing (green checkmarks)

## Post-Deployment Verification

### Service Health
```bash
# Check n8n
curl https://n8n.yourdomain.com/healthz
```
- [ ] Returns 200 OK

```bash
# Check playwright (if exposed)
curl http://your-server:3010/health
```
- [ ] Returns JSON with status: "healthy"

```bash
# Check Docker containers
docker ps | grep -E 'n8n|playwright'
```
- [ ] Both containers running
- [ ] Status shows "healthy"

### Webhook Testing
```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Test OTP is 123456"}'
```
- [ ] Returns 200 OK
- [ ] Response shows parsed OTP
- [ ] No error messages

### n8n Access
- [ ] Can access `https://n8n.yourdomain.com`
- [ ] Can log in successfully
- [ ] Dashboard loads correctly

## Workflow Setup

### Import Workflow
- [ ] In n8n, go to "Workflows"
- [ ] Click "Import from File"
- [ ] Select `n8n-otp-voucher-workflow.json`
- [ ] Workflow imported successfully
- [ ] No errors in workflow nodes

### Workflow Configuration
- [ ] Opened imported workflow
- [ ] Checked webhook URL is correct
- [ ] Verified environment variables are accessible
- [ ] Clicked "Activate" toggle
- [ ] Workflow status shows "Active" ✅

### Test Workflow Execution
- [ ] Clicked "Execute Workflow" (manual test)
- [ ] OR sent test webhook request
- [ ] Execution completed successfully
- [ ] No errors in execution log

## iOS Shortcut Setup

### Create Shortcut
- [ ] Opened Shortcuts app on iPhone
- [ ] Created new Shortcut
- [ ] Added "When I receive a text message" automation
- [ ] Added "Get contents of URL" action
- [ ] Configured webhook URL
- [ ] Set method to POST
- [ ] Added Content-Type: application/json header
- [ ] Set body to: `{"message": "[Message Content]"}`

### Test Shortcut
- [ ] Send test SMS to yourself
- [ ] Shortcut triggers automatically
- [ ] Check n8n execution log
- [ ] OTP parsed correctly

## Integration Testing

### End-to-End Test

#### Test 1: Mobile OTP
```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Your OTP is 123456"}'
```
- [ ] Returns success
- [ ] mobile_otp stored correctly
- [ ] Expires in 40 seconds

#### Test 2: Payment OTP
```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "SafeKey OTP for INR 500 is 789012"}'
```
- [ ] Returns success
- [ ] payment_otp stored correctly
- [ ] Expires in 40 seconds

#### Test 3: Voucher Detection
```bash
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Voucher Code: ABC123 PIN: 4567"}'
```
- [ ] Returns success
- [ ] Voucher code extracted
- [ ] PIN extracted
- [ ] (Optional) Auto-claim triggered

#### Test 4: Full Automation
- [ ] Trigger automation via n8n
- [ ] Send mobile OTP via iOS Shortcut
- [ ] Send payment OTP via iOS Shortcut
- [ ] Automation completes successfully
- [ ] Voucher received

## Monitoring Setup

### Log Monitoring
```bash
# Follow n8n logs
docker logs -f n8n
```
- [ ] Logs showing activity
- [ ] No critical errors

```bash
# Follow playwright logs
docker logs -f playwright-service
```
- [ ] Service running
- [ ] Health checks passing

### Resource Monitoring
```bash
docker stats
```
- [ ] CPU usage reasonable (< 80%)
- [ ] Memory usage reasonable (< 2GB for playwright)
- [ ] No memory leaks

## Production Checklist

### Security
- [ ] All secrets in Dokploy environment (not in repo)
- [ ] HTTPS enabled for n8n
- [ ] Strong n8n password set
- [ ] Playwright not exposed externally (or secured)
- [ ] Regular security updates planned

### Backup
- [ ] n8n workflows exported
- [ ] Environment variables documented
- [ ] Backup schedule configured
- [ ] Recovery plan documented

### Performance
- [ ] Container memory sufficient (min 2GB)
- [ ] SSD storage for volumes
- [ ] Network latency acceptable
- [ ] OTP polling works reliably

### Documentation
- [ ] Team trained on system
- [ ] Troubleshooting guide accessible
- [ ] Support contacts documented
- [ ] Escalation process defined

## Troubleshooting

If anything fails, check:

### Common Issues
- [ ] Environment variables set correctly
- [ ] Domain DNS resolves correctly
- [ ] SSL certificate valid
- [ ] Both services healthy
- [ ] Docker network configured
- [ ] Sufficient server resources

### Where to Look
1. **Dokploy Dashboard** → Logs
2. **Docker logs**: `docker logs n8n` and `docker logs playwright-service`
3. **n8n Executions**: Check workflow execution history
4. **Health endpoints**: Test `/health` and `/healthz`

### Get Help
- [ ] Checked `TROUBLESHOOTING.md` (if exists)
- [ ] Reviewed `DEPLOYMENT.md` for detailed steps
- [ ] Consulted `QUICK_REFERENCE.md` for commands
- [ ] Checked GitHub Issues
- [ ] Contacted support

## Sign-Off

### Deployment Complete
- [ ] All checks passed ✅
- [ ] System tested end-to-end ✅
- [ ] Monitoring in place ✅
- [ ] Documentation updated ✅
- [ ] Team notified ✅

**Deployed By**: _________________

**Date**: _________________

**Deployment Time**: _________________

**Notes**: 
```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Next Steps After Deployment

1. **Monitor for 24 hours**
   - Check logs regularly
   - Verify OTP polling works
   - Test edge cases

2. **Document Any Issues**
   - Note any failures
   - Track resolution time
   - Update documentation

3. **Optimize if Needed**
   - Adjust polling intervals
   - Fine-tune timeouts
   - Scale resources if required

4. **Regular Maintenance**
   - Update dependencies monthly
   - Rotate credentials quarterly
   - Review logs weekly
   - Test backups monthly

---

**Checklist Version**: 1.0  
**Last Updated**: 2025-12-15  

✅ **Ready for Production Deployment**





