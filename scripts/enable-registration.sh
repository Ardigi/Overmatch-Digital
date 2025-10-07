#!/bin/bash

# Temporarily enable registration in auth service
echo "Updating auth service to allow registration..."

# First check if the environment variable exists
docker exec overmatch-digital-auth-service-1 env | grep -i register || echo "No registration env var found"

# Try to update the auth controller to allow registration
echo "Note: Registration might be disabled in the code. You may need to:"
echo "1. Update the auth.controller.ts to remove the registration check"
echo "2. Rebuild the auth service"
echo "3. Or use the dev-login bypass at http://localhost:3000/dev-login"