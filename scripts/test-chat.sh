#!/bin/bash
# Test the chat endpoint locally or on production.
# Usage: ./test-chat.sh [base_url]
set -e
BASE="${1:-http://localhost:3001}"
COOKIE="/tmp/marq-test-cookies.txt"

echo "=== Testing against: $BASE ==="
echo ""

# Login
echo "=== Login ==="
curl -s -c "$COOKIE" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@marq.ai","password":"marq-demo-123"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Logged in as: {d[\"user\"][\"email\"]}')"
echo ""

# Send message
echo "=== Send 'hi' ==="
curl -s -b "$COOKIE" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hi"}' \
  --max-time 30 > /tmp/chat-response.json

python3 << 'PYEOF'
import json
with open("/tmp/chat-response.json") as f:
    raw = f.read()
if not raw.strip():
    print("  ERROR: Empty response from server")
    exit(1)
d = json.loads(raw)
if "error" in d:
    print(f"  ERROR: {d['error']}")
    if "detail" in d:
        print(f"  detail: {d['detail'][:200]}")
    exit(1)
print(f"  Provider:  {d['provider']['displayName']} ({d['provider']['name']})")
print(f"  Model:     {d['model']}")
print(f"  Failed over: {d['failedOver']}")
print(f"  Fallback:  {d['fallback']}")
print(f"  Latency:   {d['message']['latencyMs']}ms")
print(f"  Tokens:    {d['message']['tokensUsed']}")
print()
print("Attempts:")
for a in d.get("attempts", []):
    if a["success"]:
        status = "  OK  success"
    elif a.get("skipped"):
        status = "  --  skipped"
    else:
        status = "  XX  failed "
    reason = f" ({a.get('reason')})" if a.get("reason") else ""
    print(f"  {status}  {a['providerName']}{reason}")
print()
print("Response content (first 800 chars):")
print(d["message"]["content"][:800])
PYEOF
