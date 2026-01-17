#!/bin/sh
set -e

echo "Starting n8n with workflow auto-import..."

# Wait for n8n to be ready to accept CLI commands
# Import workflow if the file exists
if [ -f /workflows/n8n-otp-voucher-workflow.json ]; then
  echo "Importing workflow from /workflows/n8n-otp-voucher-workflow.json..."
  # Run import in background after n8n starts
  (
    sleep 10  # Wait for n8n to fully initialize
    n8n import:workflow --input=/workflows/n8n-otp-voucher-workflow.json --separate || echo "Workflow import completed (may already exist)"
    echo "Workflow import process finished"
  ) &
fi

# Start n8n (the default entrypoint)
exec n8n
