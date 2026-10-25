#!/bin/sh
set -e

# NOTE: auto-import of the baked workflow JSON was REMOVED on purpose.
# The OTP/Voucher Handler workflow (with the ShopWise parser + milestone ledger) is now
# managed directly in the n8n DB. Re-importing the repo's JSON on every boot (a) reverted
# live parser changes and (b) created a new duplicate workflow each restart (no id in the
# file). So we just start n8n; manage the workflow via the n8n UI / CLI.

echo "Starting n8n (workflow auto-import disabled — workflow is managed in the n8n DB)"
exec n8n
