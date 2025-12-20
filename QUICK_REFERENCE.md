# 🚀 Quick Reference Card

## One-Command Setup

```bash
# 1. Copy environment template
cp example.env .env

# 2. Edit .env with your credentials
nano .env

# 3. Validate configuration
npm run validate

# 4. Deploy to Dokploy
# (Push to GitHub, then deploy via Dokploy dashboard)
```

## Essential URLs

```
n8n Dashboard:  https://your-n8n-domain.com
Webhook URL:    https://your-n8n-domain.com/webhook/ios-sms
Health Check:   https://your-n8n-domain.com/healthz
```

## Critical Environment Variables

```env
# Minimum required for basic operation
MOBILE=9876543210
EMAIL=you@example.com
CARD_CVV=123
N8N_HOST=n8n.yourdomain.com
N8N_BASE_URL=https://n8n.yourdomain.com
```

## Service Communication

```
iOS → n8n webhook → Playwright Service → Gyftr
      ↓
   Parse OTP
      ↓
   Store (40s TTL)
      ↓
   Playwright polls for OTP
      ↓
   Complete purchase
```

## Testing Checklist

```bash
# 1. Test n8n health
curl https://n8n.yourdomain.com/healthz

# 2. Test webhook
curl -X POST https://n8n.yourdomain.com/webhook/ios-sms \
  -H "Content-Type: application/json" \
  -d '{"message": "OTP is 123456"}'

# 3. Check Docker services
docker ps | grep -E 'n8n|playwright'

# 4. View logs
docker logs -f n8n
docker logs -f playwright-service
```

## Common Issues & Quick Fixes

| Issue | Command |
|-------|---------|
| Services won't start | `docker-compose up -d --force-recreate` |
| Check service health | `docker ps` and look for "healthy" status |
| View errors | `docker logs playwright-service` |
| Restart everything | `docker-compose restart` |
| Clear volumes | `docker-compose down -v && docker-compose up -d` |

## npm Quick Commands

```bash
npm run validate      # Check environment setup
npm run docker:build  # Build images
npm run docker:up     # Start services
npm run docker:down   # Stop services
npm run docker:logs   # Watch logs
```

## iOS Shortcut Template

```
Automation: When I receive a text message
Action: Get contents of URL
  - URL: https://n8n.yourdomain.com/webhook/ios-sms
  - Method: POST
  - Headers: Content-Type: application/json
  - Body: {"message": "[Message Content]"}
```

## Health Check Endpoints

```bash
# n8n
GET https://n8n.yourdomain.com/healthz

# Playwright (internal)
GET http://playwright-service:3000/health
GET http://playwright-service:3000/status
```

## Environment Variables Priority

1. **Must Have** (System won't work without these):
   - `MOBILE`, `EMAIL`, `CARD_CVV`
   - `N8N_HOST`, `N8N_BASE_URL`

2. **Important** (Needed for specific cards):
   - `GOLD_CHARGE_CVV` (if using Gold Charge card)

3. **Optional** (For auto-claim feature):
   - `SWIGGY_DEVICE_ID`, `SWIGGY_TID`, `SWIGGY_TOKEN`

## Deployment Flow

```
1. GitHub Push
   ↓
2. Dokploy detects change
   ↓
3. Build Docker images
   ↓
4. Run health checks
   ↓
5. Deploy services
   ↓
6. Map domain
   ↓
7. ✅ Ready!
```

## Monitoring Commands

```bash
# Container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Resource usage
docker stats --no-stream

# Recent logs (last 50 lines)
docker logs --tail 50 n8n
docker logs --tail 50 playwright-service

# Follow logs in real-time
docker logs -f --tail 100 playwright-service
```

## Emergency Recovery

```bash
# Nuclear option - restart everything
docker-compose down
docker system prune -f
docker-compose up -d

# Check if it worked
docker ps
docker logs -f n8n
```

## Port Reference

| Service | Internal Port | External (Optional) |
|---------|--------------|---------------------|
| n8n | 5678 | Via Dokploy proxy |
| playwright-service | 3000 | 3010 (if exposed) |

## Key Files

- `docker-compose.yml` - Service orchestration
- `Dockerfile.playwright` - Playwright container
- `.env` - Your credentials (never commit!)
- `n8n-otp-voucher-workflow.json` - Import this to n8n

## Success Metrics

- ✅ Both containers running
- ✅ Health checks passing
- ✅ n8n accessible via domain
- ✅ Webhook responds to test requests
- ✅ Playwright can poll n8n
- ✅ Complete automation works end-to-end

## Support

- 📖 **Quick Setup**: `DOKPLOY_SETUP.md`
- 📚 **Full Guide**: `DEPLOYMENT.md`
- 📋 **Summary**: `SUMMARY.md`
- 🐛 **Issues**: GitHub Issues
- 🔍 **Validation**: `npm run validate`

---

**Pro Tip**: Keep this file handy during deployment and troubleshooting! 🎯





