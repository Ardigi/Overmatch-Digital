#!/bin/bash

# Setup script for initial admin user
# This script creates the first admin user and properly configures it

echo "Setting up initial admin user..."

# Check if user already exists
USER_COUNT=$(docker exec -e PGPASSWORD=soc_pass overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@overmatch.digital';")

if [ $USER_COUNT -gt 0 ]; then
    echo "Admin user already exists. Configuring..."
    
    # Update user to ensure proper settings
    docker exec -e PGPASSWORD=soc_pass overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -c "
        UPDATE users 
        SET \"emailVerified\" = true,
            \"mfaEnabled\" = false,
            status = 'active',
            \"failedLoginAttempts\" = 0,
            \"lockedUntil\" = NULL
        WHERE email = 'admin@overmatch.digital';
    "
    
    echo "Admin user configured successfully."
else
    echo "Creating admin user via setup endpoint..."
    
    # Call setup endpoint
    RESPONSE=$(curl -X POST http://localhost:3001/auth/setup \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"admin@overmatch.digital\",\"password\":\"Welcome123!\",\"firstName\":\"System\",\"lastName\":\"Administrator\",\"organizationName\":\"Overmatch Digital\",\"setupKey\":\"setup-key-123\"}" \
        -s)
    
    if echo "$RESPONSE" | grep -q "Initial setup completed successfully"; then
        echo "Admin user created successfully."
        
        # Ensure email is verified and MFA is disabled
        docker exec -e PGPASSWORD=soc_pass overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -c "
            UPDATE users 
            SET \"emailVerified\" = true,
                \"mfaEnabled\" = false
            WHERE email = 'admin@overmatch.digital';
        "
        
        echo "Admin user configured successfully."
    else
        echo "Error creating admin user: $RESPONSE"
        exit 1
    fi
fi

# Create known device entry to avoid risk assessment MFA
echo "Adding known device for admin..."
USER_ID=$(docker exec -e PGPASSWORD=soc_pass overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -t -c "SELECT id FROM users WHERE email = 'admin@overmatch.digital';" | tr -d ' ')

# Add known device fingerprint
docker exec -e PGPASSWORD=soc_pass overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -c "
    INSERT INTO known_devices (id, \"userId\", fingerprint, \"lastSeen\", \"createdAt\", \"updatedAt\")
    VALUES (gen_random_uuid(), '$USER_ID', 'trusted-setup-device', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
"

echo "Setup complete!"
echo ""
echo "Admin credentials:"
echo "Email: admin@overmatch.digital"
echo "Password: Welcome123!"
echo ""
echo "You can now login at: http://localhost:8000/api/auth/auth/login"