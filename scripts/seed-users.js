#!/usr/bin/env node

/**
 * Simple seed script to create initial users via API
 * Run with: node scripts/seed-users.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:8000/api';

// Since registration is disabled, we need to create users directly in the database
// This script would normally be run inside the auth-service container

const seedUsers = [
  {
    email: 'admin@overmatch.digital',
    password: 'Welcome123!',
    firstName: 'System',
    lastName: 'Administrator',
    organizationName: 'Overmatch Digital',
  },
  {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    organizationName: 'Test Organization',
  },
];

async function createUsers() {
  console.log('🌱 Starting user seed process...');

  for (const user of seedUsers) {
    try {
      // Since registration is disabled, we'll need to run this inside the container
      // or create a special admin endpoint for initial setup
      console.log(`Creating user: ${user.email}`);

      // For now, we'll document the SQL commands that need to be run
      console.log(`
-- Run these commands in PostgreSQL to create initial users:
-- Connect to the database first: docker exec -it overmatch-digital-postgres-1 psql -U soc_user -d soc_auth

-- Create organization
INSERT INTO organizations (id, name, "legalName", type, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '${user.organizationName}',
  '${user.organizationName}',
  'CLIENT',
  'active',
  NOW(),
  NOW()
);

-- Create user (password hash for '${user.password}')
-- Note: This is a bcrypt hash that needs to be generated
INSERT INTO users (id, email, password, "firstName", "lastName", status, "userType", "organizationId", "emailVerified", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '${user.email}',
  '$2b$12$HASH_NEEDS_TO_BE_GENERATED', -- Use bcrypt to hash the password
  '${user.firstName}',
  '${user.lastName}',
  'active',
  'INTERNAL',
  (SELECT id FROM organizations WHERE name = '${user.organizationName}' LIMIT 1),
  true,
  NOW(),
  NOW()
);
      `);
    } catch (error) {
      console.error(`Failed to create user ${user.email}:`, error.message);
    }
  }

  console.log('\n✅ User creation SQL generated!');
  console.log('📝 Run the SQL commands above in PostgreSQL to create the users.');
}

createUsers();
