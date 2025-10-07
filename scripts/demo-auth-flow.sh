#!/bin/bash

echo "=== SOC Compliance Platform - Authentication Flow Demo ==="
echo ""
echo "This demo shows the working authentication flow using Kong API Gateway"
echo "with header-based authentication for microservices."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Service URLs
CLIENT_SERVICE="http://localhost:3002"
AUTH_SERVICE="http://localhost:3001"
KONG_GATEWAY="http://localhost:8000"

echo -e "${BLUE}Step 1: Testing Client Service Health${NC}"
echo "Checking if Client Service is running..."
curl -s "$CLIENT_SERVICE/api/v1/health" | jq '.'
echo ""

echo -e "${BLUE}Step 2: Testing Kong Headers Authentication${NC}"
echo "Making authenticated request with Kong headers..."
echo ""

# Simulate Kong headers
USER_ID="12345678-9012-3456-7890-123456789012"
ORG_ID="a1b2c3d4-e5f6-7890-1234-567890abcdef"
USER_EMAIL="admin@soc-compliance.com"
USER_ROLES="admin,compliance_manager"

echo -e "${YELLOW}Headers being sent:${NC}"
echo "x-user-id: $USER_ID"
echo "x-organization-id: $ORG_ID"
echo "x-user-email: $USER_EMAIL"
echo "x-user-roles: $USER_ROLES"
echo ""

echo -e "${GREEN}Testing authentication endpoint:${NC}"
curl -s "$CLIENT_SERVICE/api/v1/test/auth" \
  -H "x-user-id: $USER_ID" \
  -H "x-organization-id: $ORG_ID" \
  -H "x-user-email: $USER_EMAIL" \
  -H "x-user-roles: $USER_ROLES" | jq '.'
echo ""

echo -e "${GREEN}Testing role-based access control:${NC}"
curl -s "$CLIENT_SERVICE/api/v1/test/roles" \
  -H "x-user-id: $USER_ID" \
  -H "x-organization-id: $ORG_ID" \
  -H "x-user-email: $USER_EMAIL" \
  -H "x-user-roles: $USER_ROLES" | jq '.'
echo ""

echo -e "${BLUE}Step 3: Simulating Unauthorized Access${NC}"
echo "Testing without required headers..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$CLIENT_SERVICE/api/v1/test/auth")
echo -e "Response code: ${YELLOW}$response${NC} (Should be 401)"
echo ""

echo -e "${BLUE}Step 4: Testing Role Restrictions${NC}"
echo "Testing with user role instead of admin..."
curl -s "$CLIENT_SERVICE/api/v1/test/roles" \
  -H "x-user-id: $USER_ID" \
  -H "x-organization-id: $ORG_ID" \
  -H "x-user-email: user@soc-compliance.com" \
  -H "x-user-roles: user" | jq '.'
echo ""

echo -e "${GREEN}=== Demo Complete ===${NC}"
echo ""
echo "Key Implementation Details:"
echo "1. Kong API Gateway validates JWT tokens and adds user headers"
echo "2. Microservices trust Kong headers (x-user-id, x-organization-id, etc.)"
echo "3. No JWT validation needed in individual services"
echo "4. Role-based access control using Kong headers"
echo "5. Simplified architecture with better performance"
echo ""
echo "Next Steps:"
echo "- Complete database setup for full CRUD operations"
echo "- Implement Evidence and Control services"
echo "- Build frontend with Next.js"
echo "- Add Kafka event streaming"