#!/bin/bash

# Simple auth test script

echo "1. Registering user..."
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "email": "jwt.test@example.com",
  "password": "Test123!@#",
  "firstName": "JWT",
  "lastName": "Test"
}
EOF

echo -e "\n\n2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "email": "jwt.test@example.com",
  "password": "Test123!@#"
}
EOF
)

echo "Login response: $LOGIN_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to get access token"
  exit 1
fi

echo -e "\n3. Got token: ${ACCESS_TOKEN:0:50}..."

echo -e "\n4. Testing client service with JWT..."
curl -X GET http://localhost:3002/api/v1/clients \
  -H "Authorization: Bearer $ACCESS_TOKEN"

echo -e "\n\n5. Testing client service through Kong..."
curl -X GET http://localhost:8000/api/clients/clients \
  -H "Authorization: Bearer $ACCESS_TOKEN"

echo -e "\n"