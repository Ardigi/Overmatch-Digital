#!/bin/bash

# Test JWT Authentication Across Services
# This script tests JWT token validation across all microservices

echo "=== Testing JWT Authentication Across Services ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kong Gateway URL
KONG_URL="http://localhost:8000"

# Step 1: Register a test user
echo "1. Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$KONG_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "Test",
    "lastName": "User",
    "organizationName": "Test Organization"
  }')

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to register user${NC}"
  exit 1
fi

echo -e "${GREEN}User registered successfully${NC}"
echo ""

# Step 2: Login to get JWT token
echo "2. Logging in to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "$KONG_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }')

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to login${NC}"
  exit 1
fi

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Failed to extract access token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}Login successful, got JWT token${NC}"
echo "Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Step 3: Test authenticated endpoints
echo "3. Testing authenticated endpoints..."
echo ""

# Test Auth Service
echo -n "Testing Auth Service /profile endpoint: "
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Success (200)${NC}"
else
  echo -e "${RED}✗ Failed ($HTTP_CODE)${NC}"
fi

# Test Client Service
echo -n "Testing Client Service /clients endpoint: "
CLIENT_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/clients/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP_CODE=$(echo "$CLIENT_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Success (200)${NC}"
else
  echo -e "${RED}✗ Failed ($HTTP_CODE)${NC}"
fi

# Test Policy Service
echo -n "Testing Policy Service /policies endpoint: "
POLICY_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/policies/policies" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP_CODE=$(echo "$POLICY_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Success (200)${NC}"
else
  echo -e "${YELLOW}⚠ Service may not be running ($HTTP_CODE)${NC}"
fi

# Test Evidence Service
echo -n "Testing Evidence Service /evidence endpoint: "
EVIDENCE_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/evidence/evidence" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP_CODE=$(echo "$EVIDENCE_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Success (200)${NC}"
else
  echo -e "${YELLOW}⚠ Service may not be running ($HTTP_CODE)${NC}"
fi

# Test Control Service
echo -n "Testing Control Service /controls endpoint: "
CONTROL_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/controls/controls" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP_CODE=$(echo "$CONTROL_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Success (200)${NC}"
else
  echo -e "${YELLOW}⚠ Service may not be running ($HTTP_CODE)${NC}"
fi

echo ""
echo "4. Testing unauthenticated access (should fail)..."
echo ""

# Test without token
echo -n "Testing Client Service without token: "
UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/clients/clients")
HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ Correctly rejected ($HTTP_CODE)${NC}"
else
  echo -e "${RED}✗ Should have been rejected but got ($HTTP_CODE)${NC}"
fi

# Test with invalid token
echo -n "Testing Client Service with invalid token: "
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" "$KONG_URL/api/clients/clients" \
  -H "Authorization: Bearer invalid-token-12345")
HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ Correctly rejected ($HTTP_CODE)${NC}"
else
  echo -e "${RED}✗ Should have been rejected but got ($HTTP_CODE)${NC}"
fi

echo ""
echo "=== JWT Authentication Test Complete ==="#"