# Deployment Guide for Dokploy

This guide explains how to deploy the Voucher Automation System on Dokploy.

## Prerequisites

- Dokploy instance running
- GitHub repository with your code
- Environment variables ready

## Architecture

The system consists of two services:

1. **n8n** - Workflow automation engine
   - Receives SMS webhooks from iOS Shortcut
   - Parses OTP and voucher data
   - Auto-claims Swiggy vouchers
   - Orchestrates the Playwright automation

2. **playwright-service** - Browser automation
   - Runs headless Chrome
   - Automates AmEx Gyftr purchase flow
   - Polls n8n for OTPs
   - Handles payment flow

## Deployment Steps

### 1. Create New Application in Dokploy

1. Go to your Dokploy dashboard
2. Click **Create Application**
3. Select **Docker Compose** as the deployment type
4. Connect your GitHub repository

### 2. Configure Environment Variables

In Dokploy, add the following environment variables:

#### AmEx Gyftr Credentials
```
MOBILE=your_mobile_number
EMAIL=your_email@example.com
MEMBERSHIP_CARD_CVV=123
GOLDCHARGE_CARD_CVV=456
USE_GOLDCHARGE_CARD=false
```

#### n8n Configuration
```
N8N_HOST=your-n8n-domain.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=false
N8N_BASE_URL=https://your-n8n-domain.com
WEBHOOK_PATH=/webhook/ios-sms
GENERIC_TIMEZONE=Asia/Kolkata
```

#### Swiggy Auto-Claim (Optional)
```
SWIGGY_VOUCHER_CLAIM_URL=https://chkout.swiggy.com/swiggymoney/voucher/claim
SWIGGY_DEVICE_ID=your_device_id
SWIGGY_TID=your_tid
SWIGGY_TOKEN=your_swiggy_token
```

#### Playwright Configuration
```
PLAYWRIGHT_HOST_PORT=3010
TZ=Asia/Kolkata
```

### 3. Configure Dokploy Settings

#### Domain Configuration
- Set up domain for n8n (e.g., `n8n.yourdomain.com`)
- Configure SSL certificate (Let's Encrypt)
- Point to port 5678 for n8n service

#### Port Mapping (if needed)
- n8n: Internal 5678 → External via domain
- playwright-service: Internal 3000 (no external exposure needed)

### 4. Import n8n Workflow

After deployment:

1. Access your n8n instance at `https://your-n8n-domain.com`
2. Go to **Workflows** → **Import from File**
3. Upload `n8n-otp-voucher-workflow.json`
4. Activate the workflow

### 5. Configure iOS Shortcut

1. Get your webhook URL: `https://your-n8n-domain.com/webhook/ios-sms`
2. Set up iOS Shortcut to send SMS data to this URL
3. Format: `{"message": "OTP is 123456"}`

## Service Communication

The services communicate internally via Docker network:

```
playwright-service:3000 ←→ n8n:5678
```

- **n8n → playwright**: Calls `http://playwright-service:3000/start` to trigger automation
- **playwright → n8n**: Polls `http://n8n:5678/webhook/ios-sms` for OTPs

## Health Checks

Both services have health checks:

- **n8n**: `http://localhost:5678/healthz`
- **playwright-service**: `http://localhost:3000/health`

## Troubleshooting

### Service Not Starting

Check logs in Dokploy:
```bash
# View n8n logs
docker logs n8n

# View playwright logs
docker logs playwright-service
```

### Playwright Fails

Common issues:
1. **Missing dependencies**: Ensure Dockerfile installs all Playwright deps
2. **Insufficient memory**: Increase container memory (min 2GB recommended)
3. **shm_size too small**: Already set to 1GB in docker-compose.yml

### n8n Workflow Not Receiving Data

1. Check webhook URL is correct
2. Verify iOS Shortcut is sending data
3. Check n8n execution logs
4. Test webhook manually:
   ```bash
   curl -X POST https://your-n8n-domain.com/webhook/ios-sms \
     -H "Content-Type: application/json" \
     -d '{"message": "OTP is 123456"}'
   ```

### Services Can't Communicate

1. Verify both services are on the same Docker network
2. Check service names match in environment variables
3. Use internal URLs (not public domains) for inter-service communication

## Monitoring

### Check Service Status

```bash
# Check if services are running
docker ps

# Check health status
docker inspect n8n --format='{{json .State.Health}}'
docker inspect playwright-service --format='{{json .State.Health}}'
```

### View Logs

```bash
# Follow n8n logs
docker logs -f n8n

# Follow playwright logs
docker logs -f playwright-service
```

## Security Notes

1. **Environment Variables**: Store sensitive data in Dokploy's environment variables (not in .env file)
2. **Network Isolation**: Playwright service doesn't need to be exposed externally
3. **SSL**: Always use HTTPS for n8n webhook endpoint
4. **Credentials**: Rotate Swiggy tokens regularly

## Scaling

For high-volume usage:

1. **n8n**: Can scale horizontally with Redis queue
2. **playwright-service**: Run multiple instances with load balancer
3. **Database**: Use external PostgreSQL for n8n (optional)

## Backup

Important data to backup:
- n8n workflows: `/home/node/.n8n` volume
- Environment variables
- Playwright screenshots: `/app/screenshots` volume

## Updates

To update the application:

1. Push changes to GitHub
2. In Dokploy, go to your application
3. Click **Redeploy**
4. Monitor logs for successful deployment

## Support

For issues:
1. Check logs first
2. Review [GitHub Issues](https://github.com/bluebox/automate_vouchers/issues)
3. Verify environment variables are correct
4. Test services individually

## Performance Tips

1. **Use SSD storage** for Docker volumes
2. **Allocate sufficient RAM**: Minimum 2GB for playwright-service
3. **Enable BuildKit** for faster Docker builds
4. **Use Docker layer caching** in Dokploy

---

**Last Updated**: 2025-01-15





