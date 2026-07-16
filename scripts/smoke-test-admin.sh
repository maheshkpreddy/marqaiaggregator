#!/bin/bash
# Smoke-test the new super admin endpoints.
set -e
cd /home/z/my-project

# Start dev server in background
PORT=3004 npx next dev > /tmp/next-smoke.log 2>&1 &
DEV_PID=$!
echo "Started dev server pid=$DEV_PID, waiting for ready..."

# Wait for ready
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3004/api/setup-status 2>/dev/null; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

# Login as super admin
echo ""
echo "=== Login as super admin ==="
curl -s -c /tmp/cookies-smoke.txt -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marq.ai","password":"marq-admin-123"}' | head -c 300
echo ""

# Test admin/stats
echo ""
echo "=== /api/admin/stats ==="
curl -s -b /tmp/cookies-smoke.txt http://localhost:3004/api/admin/stats
echo ""

# Test admin/plans
echo ""
echo "=== /api/admin/plans (first 500 chars) ==="
curl -s -b /tmp/cookies-smoke.txt http://localhost:3004/api/admin/plans | head -c 500
echo ""

# Test admin/orgs
echo ""
echo "=== /api/admin/orgs (first 500 chars) ==="
curl -s -b /tmp/cookies-smoke.txt "http://localhost:3004/api/admin/orgs" | head -c 500
echo ""

# Test admin/users
echo ""
echo "=== /api/admin/users (first 500 chars) ==="
curl -s -b /tmp/cookies-smoke.txt "http://localhost:3004/api/admin/users" | head -c 500
echo ""

# Test 403: regular user cannot hit admin endpoint
echo ""
echo "=== Demo user tries /api/admin/stats (should be 403) ==="
curl -s -c /tmp/cookies-demo.txt -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@marq.ai","password":"marq-demo-123"}' > /dev/null
curl -s -b /tmp/cookies-demo.txt -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3004/api/admin/stats

# Cleanup
echo ""
echo "=== Cleaning up ==="
kill $DEV_PID 2>/dev/null || true
sleep 1
echo "Done"
