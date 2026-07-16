#!/bin/bash
# End-to-end test: signup → pending → admin approves → user can log in
set -e
cd /home/z/my-project

# Start dev server
PORT=3005 npx next dev > /tmp/next-e2e.log 2>&1 &
DEV_PID=$!
echo "Started dev server pid=$DEV_PID, waiting for ready..."

for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3005/api/setup-status 2>/dev/null; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

# 1. Signup a new org
echo ""
echo "=== 1. New company signup (Acme Corp) ==="
SIGNUP_RESP=$(curl -s -c /tmp/cookies-acme.txt -X POST http://localhost:3005/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@acme.test","password":"acme-test-123","name":"Acme Founder","orgName":"Acme Corp"}')
echo "$SIGNUP_RESP" | head -c 400
echo ""

# Verify the new org is pending
ACME_STATUS=$(echo "$SIGNUP_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['org']['status'])")
echo "Acme Corp status: $ACME_STATUS"

# 2. Login as super admin
echo ""
echo "=== 2. Super admin logs in ==="
curl -s -c /tmp/cookies-sa.txt -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marq.ai","password":"marq-admin-123"}' > /dev/null
echo "Super admin logged in."

# 3. Find the pending org
echo ""
echo "=== 3. Super admin sees pending approvals ==="
PENDING=$(curl -s -b /tmp/cookies-sa.txt "http://localhost:3005/api/admin/orgs?status=pending_approval")
echo "$PENDING" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'Found {len(d[\"orgs\"])} pending org(s):')
for o in d['orgs']:
    print(f'  - {o[\"name\"]} (id={o[\"id\"][:20]}...) owner={o[\"owner\"][\"email\"]}')
"
ACME_ID=$(echo "$PENDING" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(o['id'] for o in d['orgs'] if o['name']=='Acme Corp'))")

# 4. Approve with Pro plan, 25 seats
echo ""
echo "=== 4. Super admin approves Acme Corp with Pro plan ==="
curl -s -b /tmp/cookies-sa.txt -X PATCH "http://localhost:3005/api/admin/orgs/$ACME_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","plan":"pro","seatsTotal":25,"adminNote":"VIP customer"}' | head -c 400
echo ""

# 5. Acme founder can now log in
echo ""
echo "=== 5. Acme founder logs in (should succeed now) ==="
curl -s -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@acme.test","password":"acme-test-123"}' | head -c 500
echo ""

# 6. Verify the plan was assigned
echo ""
echo "=== 6. Verify plan in /api/auth/me ==="
curl -s -c /tmp/cookies-acme2.txt -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@acme.test","password":"acme-test-123"}' > /dev/null
curl -s -b /tmp/cookies-acme2.txt http://localhost:3005/api/auth/me | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'User: {d[\"user\"][\"email\"]}')
print(f'Org:  {d[\"org\"][\"name\"]}')
print(f'Plan: {d[\"org\"][\"plan\"]}')
print(f'Status: {d[\"org\"][\"status\"]}')
"

# Cleanup
echo ""
echo "=== Cleanup ==="
kill $DEV_PID 2>/dev/null || true
sleep 1
echo "Done"
