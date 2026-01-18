# System Architecture

## Overview

This document explains the complete architecture of the Voucher Automation System for Dokploy deployment.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Internet                                   │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                │ HTTPS (SMS Data)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         iOS Shortcut                                 │
│  • Captures incoming SMS                                            │
│  • Extracts OTP/Voucher data                                        │
│  • Sends to n8n webhook                                             │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                │ POST /webhook/ios-sms
                │ {"message": "OTP is 123456"}
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Dokploy Server                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Docker Network: voucher-network                  │  │
│  │                                                              │  │
│  │  ┌────────────────────────┐    ┌────────────────────────┐  │  │
│  │  │         n8n            │    │  playwright-service    │  │  │
│  │  │    Container           │◄──►│     Container          │  │  │
│  │  │                        │    │                        │  │  │
│  │  │  Port: 5678           │    │  Port: 3000           │  │  │
│  │  │  ┌─────────────────┐  │    │  ┌─────────────────┐  │  │  │
│  │  │  │ Webhook Handler │  │    │  │ Express Server  │  │  │  │
│  │  │  │  /webhook/*     │  │    │  │  /start         │  │  │  │
│  │  │  │  /healthz       │  │    │  │  /health        │  │  │  │
│  │  │  └─────────────────┘  │    │  │  /status        │  │  │  │
│  │  │                        │    │  └─────────────────┘  │  │  │
│  │  │  ┌─────────────────┐  │    │                        │  │  │
│  │  │  │ OTP Parser      │  │    │  ┌─────────────────┐  │  │  │
│  │  │  │ • Mobile OTP    │  │    │  │ Playwright      │  │  │  │
│  │  │  │ • Payment OTP   │  │    │  │ • Chromium      │  │  │  │
│  │  │  │ • Voucher Data  │  │    │  │ • Automation    │  │  │  │
│  │  │  └─────────────────┘  │    │  │ • Screenshots   │  │  │  │
│  │  │                        │    │  └─────────────────┘  │  │  │
│  │  │  ┌─────────────────┐  │    │                        │  │  │
│  │  │  │ Global Storage  │  │    │  ┌─────────────────┐  │  │  │
│  │  │  │ (40s TTL)       │  │    │  │ OTP Polling     │  │  │  │
│  │  │  │ • mobile_otp    │◄─┼────┼──│ Every 5s        │  │  │  │
│  │  │  │ • payment_otp   │  │    │  └─────────────────┘  │  │  │
│  │  │  │ • voucher_code  │  │    │                        │  │  │
│  │  │  │ • voucher_pin   │  │    │                        │  │  │
│  │  │  └─────────────────┘  │    │                        │  │  │
│  │  │                        │    │                        │  │  │
│  │  │  ┌─────────────────┐  │    │                        │  │  │
│  │  │  │ Swiggy Auto-    │  │    │                        │  │  │
│  │  │  │ Claim API       │  │    │                        │  │  │
│  │  │  │ (Optional)      │  │    │                        │  │  │
│  │  │  └─────────────────┘  │    │                        │  │  │
│  │  │                        │    │                        │  │  │
│  │  │  Volume:              │    │  Volume:              │  │  │
│  │  │  n8n_data             │    │  playwright_data      │  │  │
│  │  └────────────────────────┘    └────────────────────────┘  │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Dokploy Proxy/Ingress                                             │
│  • SSL/TLS Termination                                             │
│  • Domain Routing                                                  │
│  • Load Balancing                                                  │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ HTTPS (External Access)
                ▼
        User Browser / API Clients
```

## Component Details

### 1. iOS Shortcut (External)
**Purpose**: Capture and forward SMS data

**Responsibilities**:
- Listen for incoming SMS messages
- Extract message content
- Send to n8n webhook via HTTPS POST

**Data Format**:
```json
{
  "message": "Your OTP is 123456 for verification"
}
```

### 2. n8n Container

**Image**: `docker.n8n.io/n8nio/n8n:1.123.4`

**Port**: `5678` (internal), mapped via Dokploy proxy

**Responsibilities**:
1. **Webhook Reception**: Receive SMS data from iOS
2. **OTP Parsing**: Extract OTP codes using regex patterns
3. **State Management**: Store OTPs with 40-second TTL
4. **Voucher Detection**: Identify voucher codes and PINs
5. **Auto-Claim**: Call Swiggy API for automatic claiming
6. **Orchestration**: Trigger Playwright automation

**Key Endpoints**:
- `POST /webhook/ios-sms` - Receive SMS data
- `GET /healthz` - Health check
- `GET /` - Web UI

**Storage**:
- **Volume**: `n8n_data` → `/home/node/.n8n`
- **Purpose**: Workflow data, credentials, executions

**Environment Variables Required**:
```env
N8N_HOST=n8n.yourdomain.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_BASE_URL=https://n8n.yourdomain.com
WEBHOOK_URL=https://n8n.yourdomain.com/
SWIGGY_VOUCHER_CLAIM_URL=...
SWIGGY_DEVICE_ID=...
SWIGGY_TID=...
SWIGGY_TOKEN=...
```

### 3. Playwright Service Container

**Image**: Custom (built from `Dockerfile.playwright`)

**Base**: `mcr.microsoft.com/playwright:v1.54.1-jammy`

**Port**: `3000` (internal), optionally `3010` (external)

**Responsibilities**:
1. **Automation Execution**: Run browser automation
2. **OTP Retrieval**: Poll n8n for OTP codes
3. **Form Filling**: Automate Gyftr purchase flow
4. **Payment Processing**: Handle SafeKey OTP
5. **Screenshot Capture**: Save final results

**Key Endpoints**:
- `POST /start` - Trigger automation
- `GET /health` - Health check
- `GET /status` - Current status

**Storage**:
- **Volume**: `playwright_data` → `/app/screenshots`
- **Purpose**: Store automation screenshots

**Environment Variables Required**:
```env
MOBILE=9876543210
EMAIL=you@example.com
MEMBERSHIP_CARD_CVV=123
GOLDCHARGE_CARD_CVV=456
USE_GOLDCHARGE_CARD=false
N8N_BASE_URL=http://n8n:5678
WEBHOOK_PATH=/webhook/ios-sms
```

**Resources**:
- **Memory**: Minimum 2GB (Chromium requirement)
- **Shared Memory**: 1GB (configured via `shm_size`)
- **CPU**: 2+ cores recommended

## Data Flow

### Complete Purchase Flow

```
1. User initiates purchase
   │
   ├─► n8n workflow triggered (manually or scheduled)
   │
   └─► POST http://playwright-service:3000/start
       {"goldCharge": false}

2. Playwright starts automation
   │
   ├─► Navigate to Gyftr
   ├─► Add item to cart
   ├─► Proceed to checkout
   ├─► Fill mobile & email
   └─► Request mobile OTP

3. Mobile OTP received
   │
   ├─► SMS arrives on iPhone
   ├─► iOS Shortcut captures it
   ├─► POST https://n8n.yourdomain.com/webhook/ios-sms
   │   {"message": "Your OTP is 123456"}
   │
   └─► n8n parses and stores:
       {
         "mobile_otp": "123456",
         "expires_at": "2025-12-15T10:30:40Z"
       }

4. Playwright retrieves OTP
   │
   ├─► Poll: GET http://n8n:5678/webhook/ios-sms
   │         {"message": "__GET_STATE__"}
   │
   ├─► Receive: {
   │     "mobile_otp": "123456",
   │     "expires_at": "..."
   │   }
   │
   └─► Fill OTP in form

5. Payment OTP requested
   │
   ├─► Playwright submits mobile OTP
   ├─► Selects payment card
   ├─► Fills CVV
   └─► Proceeds to payment gateway

6. Payment OTP received
   │
   ├─► SafeKey SMS arrives
   ├─► iOS Shortcut captures it
   ├─► POST https://n8n.yourdomain.com/webhook/ios-sms
   │   {"message": "SafeKey OTP for INR 500 is 789012"}
   │
   └─► n8n parses and stores:
       {
         "mobile_otp": "123456",
         "payment_otp": "789012",
         "expires_at": "2025-12-15T10:31:20Z"
       }

7. Playwright retrieves payment OTP
   │
   ├─► Poll: GET http://n8n:5678/webhook/ios-sms
   │
   ├─► Receive: {
   │     "payment_otp": "789012",
   │     "expires_at": "..."
   │   }
   │
   └─► Fill payment OTP

8. Purchase completed
   │
   ├─► Playwright submits payment OTP
   ├─► Waits for SafeKey verification
   ├─► Detects success page
   ├─► Takes screenshot
   └─► Returns success

9. Voucher auto-claim (if Swiggy)
   │
   ├─► Voucher SMS arrives
   ├─► iOS Shortcut forwards to n8n
   ├─► n8n detects voucher type
   ├─► Extracts code & PIN
   │
   └─► If Swiggy:
       ├─► POST https://chkout.swiggy.com/.../claim
       │   {
       │     "code": "ABCD1234",
       │     "secret": "5678"
       │   }
       │
       └─► Response:
           {
             "statusCode": 0,
             "value": 500,
             "message": "Successfully claimed"
           }

10. End
    └─► Voucher in Swiggy wallet ✅
```

## Network Communication

### Internal Network: `voucher-network`

**Purpose**: Allow services to communicate securely

**Driver**: Bridge

**Services on Network**:
- `n8n` (hostname: `n8n`)
- `playwright-service` (hostname: `playwright-service`)

**Internal URLs**:
```
n8n → playwright:     http://playwright-service:3000/start
playwright → n8n:     http://n8n:5678/webhook/ios-sms
```

### External Access

**Via Dokploy Proxy**:
```
Internet → Dokploy Proxy → n8n:5678
```

**Domains**:
- Main: `https://n8n.yourdomain.com`
- Webhook: `https://n8n.yourdomain.com/webhook/ios-sms`

**Security**:
- SSL/TLS termination at proxy
- Internal services use HTTP
- Playwright not exposed externally (optional debug port)

## State Management

### n8n Global Storage

**Mechanism**: Workflow static data
**Access**: `$getWorkflowStaticData('global').voucher_automation`

**Schema**:
```javascript
{
  mobile_otp: "123456",       // Last mobile OTP received
  payment_otp: "789012",      // Last payment OTP received
  voucher_code: "ABCD1234",   // Last voucher code
  voucher_pin: "5678",        // Last voucher PIN
  last_updated: "2025-12-15T10:30:00.000Z",
  expires_at: "2025-12-15T10:30:40.000Z"  // 40s TTL
}
```

**TTL (Time To Live)**: 40 seconds
- OTPs expire after 40 seconds
- Old data automatically cleared
- Prevents using stale OTPs

### Playwright State

**In-Memory Only**:
- Current automation status (`isRunning`)
- Browser session
- Page context

**Persistent**:
- Screenshots saved to volume
- Logs output to Docker

## Health Checks

### n8n Health Check
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --spider -q http://localhost:5678/healthz || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Playwright Health Check
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --spider -q http://localhost:3000/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Health Check Response**:
```json
{
  "status": "healthy",
  "service": "playwright-automation",
  "isRunning": false,
  "timestamp": "2025-12-15T10:30:00.000Z"
}
```

## Dependencies

### Service Dependencies

```yaml
n8n:
  depends_on:
    playwright-service:
      condition: service_healthy
```

**Startup Order**:
1. `playwright-service` starts
2. Health check waits for service to be ready
3. `n8n` starts only after playwright is healthy

### Software Dependencies

**n8n**:
- Node.js (included in image)
- n8n core and nodes

**Playwright Service**:
- Node.js 16+
- Express.js
- Playwright
- Axios
- Chromium browser + dependencies

## Volumes

### n8n_data Volume
```yaml
n8n_data:
  driver: local
```

**Mounted At**: `/home/node/.n8n`

**Contains**:
- Workflow definitions
- Credentials (encrypted)
- Execution history
- Settings and configuration

**Persistence**: Survives container restarts

### playwright_data Volume
```yaml
playwright_data:
  driver: local
```

**Mounted At**: `/app/screenshots`

**Contains**:
- `final-result.png` - Success screenshot
- `error-screenshot.png` - Error screenshot
- `safekey-timeout.png` - Timeout screenshot

**Persistence**: Survives container restarts

## Security Architecture

### Network Isolation
- Internal services communicate via Docker network
- Only n8n exposed externally via Dokploy proxy
- Playwright has optional debug port (can be removed)

### Data Protection
- Environment variables never committed to repo
- Credentials stored in Dokploy environment
- n8n credentials encrypted at rest
- HTTPS for all external communication

### Access Control
- n8n requires authentication
- Webhook endpoint is public (by design)
- Playwright service not accessible from internet

## Scaling Considerations

### Current Architecture: Single Instance

**Limitations**:
- One automation at a time (`isRunning` flag)
- Single OTP storage (latest wins)
- No queue system

### Future Scaling Options

**Horizontal Scaling**:
1. **n8n**: Add Redis queue mode for multiple workers
2. **Playwright**: Run multiple instances with load balancer
3. **Storage**: Use external PostgreSQL for n8n data

**Vertical Scaling**:
1. Increase container memory (4GB+)
2. Add more CPU cores
3. Use faster storage (NVMe SSD)

## Monitoring & Observability

### Logs
```bash
# Container logs
docker logs -f n8n
docker logs -f playwright-service

# n8n execution logs (via UI)
https://n8n.yourdomain.com/executions
```

### Metrics
- Health check status
- Container resource usage
- Execution success/failure rate
- OTP retrieval latency

### Alerts (Recommended)
- Service health check failures
- OTP timeout errors
- Payment failures
- Disk space warnings

## Deployment Process

### Build Phase
1. Clone repository
2. Build Playwright Docker image
3. Pull n8n image
4. Create volumes
5. Create network

### Start Phase
1. Start playwright-service
2. Wait for health check
3. Start n8n
4. Configure Dokploy proxy
5. Map domain to n8n

### Verification Phase
1. Check container status
2. Verify health checks
3. Test webhook endpoint
4. Import workflow
5. Test complete flow

---

**Architecture Version**: 1.0  
**Last Updated**: 2025-12-15  
**Maintained By**: System Administrator





