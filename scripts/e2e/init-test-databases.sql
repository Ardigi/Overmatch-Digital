-- E2E Test Database Initialization Script
-- Creates all test databases for SOC Compliance Platform

-- Drop databases if they exist (for clean slate)
DROP DATABASE IF EXISTS soc_auth_test;
DROP DATABASE IF EXISTS soc_clients_test;
DROP DATABASE IF EXISTS soc_policies_test;
DROP DATABASE IF EXISTS soc_controls_test;
DROP DATABASE IF EXISTS soc_evidence_test;
DROP DATABASE IF EXISTS soc_workflows_test;
DROP DATABASE IF EXISTS soc_reporting_test;
DROP DATABASE IF EXISTS soc_audits_test;
DROP DATABASE IF EXISTS soc_integrations_test;
DROP DATABASE IF EXISTS soc_notifications_test;
DROP DATABASE IF EXISTS soc_ai_test;

-- Create test databases for all services
CREATE DATABASE soc_auth_test;
CREATE DATABASE soc_clients_test;
CREATE DATABASE soc_policies_test;
CREATE DATABASE soc_controls_test;
CREATE DATABASE soc_evidence_test;
CREATE DATABASE soc_workflows_test;
CREATE DATABASE soc_reporting_test;
CREATE DATABASE soc_audits_test;
CREATE DATABASE soc_integrations_test;
CREATE DATABASE soc_notifications_test;
CREATE DATABASE soc_ai_test;

-- Grant all privileges to test user
GRANT ALL PRIVILEGES ON DATABASE soc_auth_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_clients_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_policies_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_controls_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_evidence_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_workflows_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_reporting_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_audits_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_integrations_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_notifications_test TO test_user;
GRANT ALL PRIVILEGES ON DATABASE soc_ai_test TO test_user;

-- Enable UUID extension for all databases
\c soc_auth_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_clients_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_policies_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_controls_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_evidence_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_workflows_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_reporting_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_audits_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_integrations_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_notifications_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c soc_ai_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";