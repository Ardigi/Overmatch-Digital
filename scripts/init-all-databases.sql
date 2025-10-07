-- Script to create all service databases for SOC Compliance Platform
-- Run this in PostgreSQL as the postgres user

-- Create databases for each service
CREATE DATABASE IF NOT EXISTS soc_auth_db;
CREATE DATABASE IF NOT EXISTS soc_client_db;
CREATE DATABASE IF NOT EXISTS soc_audit_db;
CREATE DATABASE IF NOT EXISTS soc_policy_db;
CREATE DATABASE IF NOT EXISTS soc_controls;
CREATE DATABASE IF NOT EXISTS soc_evidence;
CREATE DATABASE IF NOT EXISTS soc_workflow;
CREATE DATABASE IF NOT EXISTS soc_reporting;
CREATE DATABASE IF NOT EXISTS soc_notification;
CREATE DATABASE IF NOT EXISTS soc_integration;
CREATE DATABASE IF NOT EXISTS soc_ai;

-- Grant privileges to soc_user
GRANT ALL PRIVILEGES ON DATABASE soc_auth_db TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_client_db TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_audit_db TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_policy_db TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_controls TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_evidence TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_workflow TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_reporting TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_notification TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_integration TO soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_ai TO soc_user;

-- List all databases to confirm
\l