#!/bin/bash

echo "🧪 Testing n8n Deployment..."
echo ""

echo "Test 1: Checking HTTPS response..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://n8n.harshit.cloud)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ n8n is accessible! (HTTP $HTTP_CODE)"
else
    echo "❌ Still getting HTTP $HTTP_CODE (expected 200)"
fi

echo ""
echo "Test 2: Checking health endpoint..."
HEALTH=$(curl -s https://n8n.harshit.cloud/healthz)
if [[ "$HEALTH" == *"ok"* ]]; then
    echo "✅ Health check passed!"
    echo "Response: $HEALTH"
else
    echo "⚠️  Unexpected health response: $HEALTH"
fi

echo ""
echo "Test 3: Checking SSL certificate..."
SSL_INFO=$(curl -vI https://n8n.harshit.cloud 2>&1 | grep "SSL certificate verify ok")
if [ -n "$SSL_INFO" ]; then
    echo "✅ SSL certificate is valid!"
else
    echo "⚠️  SSL certificate may still be provisioning..."
fi

echo ""
echo "🌐 Try opening in browser: https://n8n.harshit.cloud"

