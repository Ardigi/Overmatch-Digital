#!/bin/bash

# Create a test user via the auth service API
echo "Creating test user..."

curl -X POST http://localhost:8000/api/auth/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "Demo123!@#",
    "firstName": "Demo",
    "lastName": "User"
  }'

echo -e "\n\nTest user created:"
echo "Email: demo@example.com"
echo "Password: Demo123!@#"