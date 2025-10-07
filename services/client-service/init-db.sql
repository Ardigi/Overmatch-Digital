-- Create database if not exists
CREATE DATABASE IF NOT EXISTS soc_clients;

-- Switch to the database
\c soc_clients;

-- Create enums
CREATE TYPE client_type AS ENUM ('direct', 'partner_referral', 'managed');
CREATE TYPE client_status AS ENUM ('active', 'inactive', 'pending', 'suspended', 'archived');
CREATE TYPE company_size AS ENUM ('1-50', '51-200', '201-500', '501-1000', '1000+');
CREATE TYPE industry AS ENUM ('technology', 'healthcare', 'finance', 'retail', 'manufacturing', 'education', 'government', 'nonprofit', 'other');
CREATE TYPE compliance_framework AS ENUM ('soc1_type1', 'soc1_type2', 'soc2_type1', 'soc2_type2', 'iso27001', 'hipaa', 'gdpr', 'pci_dss', 'nist', 'fedramp');
CREATE TYPE compliance_status AS ENUM ('not_started', 'assessment', 'remediation', 'implementation', 'ready_for_audit', 'under_audit', 'compliant', 'non_compliant', 'expired');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE document_type AS ENUM ('contract', 'policy', 'procedure', 'evidence', 'report', 'certificate', 'audit_report', 'assessment', 'other');
CREATE TYPE document_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'expired', 'archived');
CREATE TYPE document_confidentiality AS ENUM ('public', 'internal', 'confidential', 'highly_confidential');
CREATE TYPE client_user_role AS ENUM ('owner', 'admin', 'manager', 'user', 'viewer', 'auditor');
CREATE TYPE client_user_status AS ENUM ('active', 'inactive', 'pending', 'suspended');
CREATE TYPE audit_type AS ENUM ('internal', 'external', 'readiness', 'surveillance', 'recertification');
CREATE TYPE audit_status AS ENUM ('planned', 'scheduled', 'in_preparation', 'in_progress', 'field_work_complete', 'pending_report', 'completed', 'cancelled');
CREATE TYPE audit_result AS ENUM ('passed', 'passed_with_conditions', 'failed', 'pending');
CREATE TYPE audit_scope AS ENUM ('full', 'limited', 'focused');