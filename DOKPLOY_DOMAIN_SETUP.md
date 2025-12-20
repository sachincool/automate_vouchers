# Dokploy Domain Configuration Guide

## ✅ What We Fixed

**Removed conflicting Traefik labels** from `docker-compose.yml`. Dokploy manages domains through its UI, so manual labels were causing conflicts.

## 📋 Current Status

From the debug output, we can see:
- ✅ **n8n is already configured** with `n8n.harshit.cloud` via Dokploy UI
- ✅ Both containers are on `dokploy-network`
- ✅ Traefik can reach the containers internally
- ⚠️ **Playwright service needs domain configuration in Dokploy UI**

## 🔧 How to Configure Domains in Dokploy UI

### For n8n (Already Done)
The Dokploy UI has already configured:
- Domain: `n8n.harshit.cloud`
- Port: 5678
- HTTPS with Let's Encrypt

### For Playwright Service (You Need to Do This)

1. **Go to Dokploy Dashboard**
   - URL: `https://dp.harshit.cloud`

2. **Navigate to Your Compose Project**
   - Select the `n8n-n8n-c2811h` project

3. **Go to Domains Tab**
   - Click on "Domains" in the left menu

4. **Add Domain for Playwright Service**
   - Click "Add Domain"
   - **Host**: `playwright.harshit.cloud` (or your preferred subdomain)
   - **Container Port**: `3000`
   - **Service Name**: Select `playwright-service` from dropdown
   - **HTTPS**: Enable (Let's Encrypt will auto-generate certificates)
   - **Path**: `/` (default)
   - Click "Save"

5. **Ensure DNS is Configured**
   ```bash
   # Add A record in your DNS provider:
   playwright.harshit.cloud -> 37.27.213.201 (your server IP)
   ```

6. **Redeploy the Compose Stack**
   - In Dokploy UI, click "Deploy" button
   - Wait for deployment to complete (~1-2 minutes)
   - Wait additional 10 seconds for SSL certificate generation

## 🧪 Testing After Deployment

### Test n8n
```bash
# Should return n8n HTML page
curl https://n8n.harshit.cloud/

# Should redirect to n8n login
open https://n8n.harshit.cloud
```

### Test Playwright Service
```bash
# Should return service response (after domain is configured)
curl https://playwright.harshit.cloud/

# Check if it's reachable
curl -I https://playwright.harshit.cloud/
```

## 🔍 Debugging Commands

### Check if domains are configured
```bash
docker exec dokploy-traefik wget -qO- http://localhost:8080/api/http/routers | jq '.[] | select(.rule | contains("playwright")) | {name, rule, status}'
```

### Check container labels
```bash
docker inspect n8n-n8n-c2811h-playwright-service-1 --format='{{json .Config.Labels}}' | jq 'to_entries[] | select(.key | startswith("traefik"))'
```

### View Traefik logs
```bash
docker logs dokploy-traefik --tail 50 --follow
```

## 📝 Important Notes

1. **Don't Mix Management Methods**
   - ❌ Don't add Traefik labels in docker-compose.yml when using Dokploy UI
   - ✅ Use Dokploy UI exclusively for domain management

2. **Port Declaration Still Required**
   - Keep `ports: - 3000` in docker-compose.yml (just the port number, no host binding)
   - This tells Docker to expose the port for Traefik to discover

3. **Network is Mandatory**
   - All services must be on `dokploy-network`
   - This is already configured correctly

4. **DNS Propagation**
   - DNS changes can take up to 24 hours to propagate globally
   - Use `dig` to check if DNS is configured correctly:
     ```bash
     dig playwright.harshit.cloud
     ```

## 🚀 Next Steps

1. ✅ **Push the updated docker-compose.yml to GitHub**
   ```bash
   git add docker-compose.yml
   git commit -m "Remove manual Traefik labels - use Dokploy UI for domain management"
   git push
   ```

2. **Configure Playwright Domain in Dokploy UI** (see steps above)

3. **Redeploy in Dokploy**

4. **Test both services are accessible**

## 🐛 Troubleshooting

### If n8n.harshit.cloud is not working:

**Check DNS:**
```bash
dig n8n.harshit.cloud
# Should return your server IP
```

**Check Traefik router:**
```bash
docker exec dokploy-traefik wget -qO- http://localhost:8080/api/http/routers | jq '.[] | select(.rule | contains("n8n.harshit.cloud"))'
```

**Check if n8n is healthy:**
```bash
docker exec n8n-n8n-c2811h-n8n-1 wget -qO- http://localhost:5678
```

### If SSL certificate fails:

**Check Let's Encrypt logs:**
```bash
docker logs dokploy-traefik 2>&1 | grep -i "acme\|certificate"
```

**Verify domain is publicly accessible:**
```bash
curl -I http://n8n.harshit.cloud/
# Should return 301 redirect to https
```

## 📚 Reference

- [Dokploy Docker Compose Domains](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Dokploy Docker Compose Example](https://docs.dokploy.com/docs/core/docker-compose/example)

