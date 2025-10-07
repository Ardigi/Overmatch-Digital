#!/bin/bash

echo "=== Simple JWT Test ==="
echo ""

# Try to access protected endpoint without token
echo "1. Testing Client Service without JWT (should fail):"
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3002/api/v1/clients

echo -e "\n2. Testing if JWT secret is set:"
docker exec overmatch-digital-client-service-1 env | grep JWT_SECRET

echo -e "\n3. Checking Client Service logs for auth errors:"
docker logs overmatch-digital-client-service-1 --tail 10 | grep -E "(auth|jwt|unauthorized)" -i || echo "No auth errors found"

echo -e "\n4. Testing health endpoint (public):"
curl -s http://localhost:3002/api/v1/health

echo -e "\n"