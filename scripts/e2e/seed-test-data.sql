-- E2E Test Data Seeding Script
-- Seeds initial test data for E2E testing

-- Connect to auth database
\c soc_auth_test;

-- Create test admin user (password: Admin123!@#)
INSERT INTO users (
    id, 
    email, 
    password, 
    "firstName", 
    "lastName", 
    "isEmailVerified", 
    "mfaEnabled",
    "mfaSecret",
    "createdAt", 
    "updatedAt"
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'admin@test.soc',
    '$2b$10$8KqW8Z6Q5V2N9RzN6V5xZO8YqH0X1Z5V8X5V8X5V8X5V8X5V8X5V8X',
    'Test',
    'Admin',
    true,
    false,
    null,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create test regular user (password: User123!@#)
INSERT INTO users (
    id, 
    email, 
    password, 
    "firstName", 
    "lastName", 
    "isEmailVerified", 
    "mfaEnabled",
    "mfaSecret",
    "createdAt", 
    "updatedAt"
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'user@test.soc',
    '$2b$10$9LrX9A7S6W3O0SaO7W6yAP9ZrI1Y2Y6W9Y6W9Y6W9Y6W9Y6W9Y6W9Y',
    'Test',
    'User',
    true,
    false,
    null,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create test unverified user (password: Unverified123!@#)
INSERT INTO users (
    id, 
    email, 
    password, 
    "firstName", 
    "lastName", 
    "isEmailVerified", 
    "mfaEnabled",
    "mfaSecret",
    "createdAt", 
    "updatedAt"
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'unverified@test.soc',
    '$2b$10$0MsY0B8T7X4P1TbP8X7zBQ0AsJ2Z3Z7X0Z7X0Z7X0Z7X0Z7X0Z7X0Z',
    'Test',
    'Unverified',
    false,
    false,
    null,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create test API keys
INSERT INTO api_keys (
    id,
    "userId",
    name,
    key,
    "lastUsedAt",
    "expiresAt",
    "createdAt",
    "updatedAt"
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Test Admin API Key',
    'test_admin_api_key_123456789',
    null,
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
) ON CONFLICT (key) DO NOTHING;

-- Connect to clients database
\c soc_clients_test;

-- Create test organization
INSERT INTO organizations (
    id,
    name,
    domain,
    industry,
    size,
    tier,
    "createdAt",
    "updatedAt"
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'Test Organization',
    'test.soc',
    'Technology',
    'medium',
    'premium',
    NOW(),
    NOW()
) ON CONFLICT (domain) DO NOTHING;

-- Create test client
INSERT INTO clients (
    id,
    "organizationId",
    name,
    type,
    status,
    "primaryContactName",
    "primaryContactEmail",
    "primaryContactPhone",
    metadata,
    "createdAt",
    "updatedAt"
) VALUES (
    '66666666-6666-6666-6666-666666666666',
    '55555555-5555-5555-5555-555555555555',
    'Test Client 1',
    'enterprise',
    'active',
    'John Doe',
    'john.doe@test.soc',
    '+1234567890',
    '{}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Connect to policies database
\c soc_policies_test;

-- Create test framework
INSERT INTO frameworks (
    id,
    name,
    version,
    description,
    "isActive",
    metadata,
    "createdAt",
    "updatedAt"
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    'SOC 2 Type II',
    '2017',
    'Service Organization Control 2 Type II',
    true,
    '{"source": "AICPA", "categories": ["Security", "Availability", "Processing Integrity", "Confidentiality", "Privacy"]}',
    NOW(),
    NOW()
) ON CONFLICT (name, version) DO NOTHING;

-- Create test policy
INSERT INTO policies (
    id,
    "frameworkId",
    "organizationId",
    name,
    description,
    category,
    status,
    content,
    metadata,
    "effectiveDate",
    "reviewDate",
    "createdAt",
    "updatedAt"
) VALUES (
    '88888888-8888-8888-8888-888888888888',
    '77777777-7777-7777-7777-777777777777',
    '55555555-5555-5555-5555-555555555555',
    'Information Security Policy',
    'Policy for information security management',
    'Security',
    'active',
    '{"version": "1.0", "sections": [{"title": "Purpose", "content": "This policy establishes information security requirements."}]}',
    '{}',
    NOW(),
    NOW() + INTERVAL '365 days',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Connect to controls database
\c soc_controls_test;

-- Create test control category
INSERT INTO control_categories (
    id,
    name,
    description,
    "frameworkId",
    "parentId",
    "order",
    metadata,
    "createdAt",
    "updatedAt"
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    'Access Control',
    'Controls for managing access to systems and data',
    '77777777-7777-7777-7777-777777777777',
    null,
    1,
    '{}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create test control
INSERT INTO controls (
    id,
    "categoryId",
    "frameworkId",
    code,
    name,
    description,
    type,
    frequency,
    "evidenceRequirements",
    metadata,
    "createdAt",
    "updatedAt"
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '99999999-9999-9999-9999-999999999999',
    '77777777-7777-7777-7777-777777777777',
    'AC-1',
    'User Access Reviews',
    'Periodic review of user access rights',
    'preventive',
    'quarterly',
    '["Access review reports", "Approval documentation"]',
    '{}',
    NOW(),
    NOW()
) ON CONFLICT (code, "frameworkId") DO NOTHING;

-- Connect to workflows database
\c soc_workflows_test;

-- Create test workflow template
INSERT INTO workflow_templates (
    id,
    name,
    description,
    type,
    steps,
    metadata,
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Control Testing Workflow',
    'Standard workflow for testing controls',
    'control_testing',
    '[{"name": "Plan", "order": 1}, {"name": "Execute", "order": 2}, {"name": "Review", "order": 3}, {"name": "Approve", "order": 4}]',
    '{}',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Connect to audits database
\c soc_audits_test;

-- Create test audit
INSERT INTO audits (
    id,
    "organizationId",
    "frameworkId",
    name,
    type,
    status,
    "startDate",
    "endDate",
    "auditPeriodStart",
    "auditPeriodEnd",
    metadata,
    "createdAt",
    "updatedAt"
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '55555555-5555-5555-5555-555555555555',
    '77777777-7777-7777-7777-777777777777',
    'Q1 2024 SOC 2 Audit',
    'SOC2_Type_II',
    'planning',
    NOW(),
    NOW() + INTERVAL '90 days',
    NOW() - INTERVAL '90 days',
    NOW(),
    '{}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create test user-organization relationships
\c soc_auth_test;

INSERT INTO user_organizations (
    id,
    "userId",
    "organizationId",
    role,
    permissions,
    "createdAt",
    "updatedAt"
) VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    'admin',
    '["*"]',
    NOW(),
    NOW()
) ON CONFLICT ("userId", "organizationId") DO NOTHING;

INSERT INTO user_organizations (
    id,
    "userId",
    "organizationId",
    role,
    permissions,
    "createdAt",
    "updatedAt"
) VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'member',
    '["read:*", "write:evidence"]',
    NOW(),
    NOW()
) ON CONFLICT ("userId", "organizationId") DO NOTHING;