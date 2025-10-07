#!/bin/bash

# Test Evidence Service through Kong Gateway

echo "Testing Evidence Service through Kong Gateway"
echo "==========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kong Gateway URL
KONG_URL="http://localhost:8000"

# First, get a JWT token from auth service
echo -e "\n${YELLOW}1. Getting JWT token from Auth Service...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${KONG_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@soc-compliance.com",
    "password": "SecureAdminPassword123!"
  }')

# Extract token
TOKEN=$(echo $AUTH_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get auth token. Response:${NC}"
  echo $AUTH_RESPONSE
  exit 1
fi

echo -e "${GREEN}✓ Got JWT token${NC}"

# Test Evidence Service health endpoint
echo -e "\n${YELLOW}2. Testing Evidence Service health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${KONG_URL}/api/evidence/health")
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Health check failed (HTTP $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

# Test Evidence Service with authentication
echo -e "\n${YELLOW}3. Testing Evidence Service with authentication...${NC}"
EVIDENCE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KONG_URL}/api/evidence/evidence")

HTTP_STATUS=$(echo "$EVIDENCE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$EVIDENCE_RESPONSE" | sed '$d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Evidence endpoint accessible${NC}"
  echo "Response: $BODY"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${RED}✗ Authentication failed${NC}"
  echo "Response: $BODY"
elif [ "$HTTP_STATUS" = "502" ] || [ "$HTTP_STATUS" = "503" ]; then
  echo -e "${RED}✗ Evidence Service not available (HTTP $HTTP_STATUS)${NC}"
  echo "The service might not be running or Kong cannot reach it."
else
  echo -e "${YELLOW}⚠ Unexpected response (HTTP $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

# Test creating evidence
echo -e "\n${YELLOW}4. Testing Evidence creation...${NC}"
CREATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "${KONG_URL}/api/evidence/evidence" \
  -d '{
    "name": "Test Evidence",
    "description": "Test evidence created via API",
    "type": "document",
    "controlId": "test-control-123",
    "clientId": "test-client-123",
    "status": "collected"
  }')

HTTP_STATUS=$(echo "$CREATE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Evidence created successfully${NC}"
  echo "Response: $BODY"
elif [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${YELLOW}⚠ Permission denied (need proper role)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Failed to create evidence (HTTP $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

echo -e "\n${YELLOW}5. Checking Kong headers...${NC}"
# Test if Kong is adding headers correctly
HEADERS_RESPONSE=$(curl -s -i -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KONG_URL}/api/evidence/evidence" | head -20)

if echo "$HEADERS_RESPONSE" | grep -q "X-User-Id:"; then
  echo -e "${GREEN}✓ Kong is adding user headers${NC}"
  echo "$HEADERS_RESPONSE" | grep "X-User-"
else
  echo -e "${YELLOW}⚠ Kong headers not found in response${NC}"
  echo "Kong might need request-transformer plugin configuration"
fi

echo -e "\n${GREEN}Evidence Service test completed!${NC}"