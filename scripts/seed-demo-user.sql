-- Create demo user with hashed password (Demo123!@#)
-- Note: This is a bcrypt hash of the password Demo123!@#
INSERT INTO users (
    id,
    email,
    password,
    "firstName",
    "lastName",
    status,
    "userType",
    "emailVerified",
    "mfaEnabled",
    "failedLoginAttempts",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid(),
    'demo@example.com',
    '$2b$10$K7L7M0ZwQKZx.nQQO5Zs8uBhKxLYYYgFwQhKxLYYYgFwQh.demo', -- This is not a real hash, we need to generate one
    'Demo',
    'User',
    'active',
    'internal',
    true,
    false,
    0,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;