-- Initialize Client Service Database Schema

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE client_type AS ENUM ('enterprise', 'mid_market', 'small_business', 'startup', 'non_profit', 'government');
CREATE TYPE client_status AS ENUM ('prospect', 'onboarding', 'active', 'inactive', 'churned', 'archived');
CREATE TYPE compliance_status AS ENUM ('not_started', 'in_progress', 'ready_for_audit', 'under_audit', 'certified', 'expired', 'at_risk');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE organization_type AS ENUM ('msp', 'client', 'partner', 'vendor', 'auditor');
CREATE TYPE organization_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE organization_size AS ENUM ('startup', 'small', 'medium', 'large', 'enterprise');

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    "legalName" character varying,
    type organization_type NOT NULL DEFAULT 'msp',
    status organization_status NOT NULL DEFAULT 'active',
    logo character varying,
    website character varying,
    industry character varying,
    size organization_size,
    address jsonb,
    "primaryContactId" character varying,
    "parentOrganizationId" uuid,
    settings jsonb,
    billing jsonb,
    metadata jsonb,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMP,
    CONSTRAINT "PK_organizations" PRIMARY KEY (id)
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    "legalName" character varying,
    slug character varying NOT NULL,
    "clientType" client_type NOT NULL DEFAULT 'enterprise',
    "organizationId" uuid NOT NULL,
    "parentClientId" uuid,
    logo character varying,
    website character varying,
    description text,
    industry character varying,
    size character varying,
    "employeeCount" integer,
    "annualRevenue" numeric(15,2),
    status client_status NOT NULL DEFAULT 'prospect',
    "complianceStatus" compliance_status NOT NULL DEFAULT 'not_started',
    "targetFrameworks" text,
    "riskLevel" risk_level NOT NULL DEFAULT 'medium',
    "complianceScore" integer DEFAULT 0,
    "contactInfo" jsonb,
    address jsonb,
    "billingInfo" jsonb,
    "partnerId" character varying,
    "partnerReferralDate" date,
    "salesRepId" character varying,
    "accountManagerId" character varying,
    "technicalLeadId" character varying,
    "onboardingStartDate" date,
    "onboardingCompleteDate" date,
    "firstAuditDate" date,
    "lastAuditDate" date,
    "nextAuditDate" date,
    "certificateExpiryDate" date,
    "auditHistory" jsonb,
    integrations jsonb,
    settings jsonb,
    metadata jsonb,
    tags text,
    "isDeleted" boolean NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "createdBy" character varying,
    "updatedBy" character varying,
    "deletedAt" TIMESTAMP,
    "deletedBy" character varying,
    CONSTRAINT "PK_clients" PRIMARY KEY (id),
    CONSTRAINT "UQ_clients_slug" UNIQUE (slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IDX_organizations_name" ON organizations (name);
CREATE INDEX IF NOT EXISTS "IDX_organizations_type" ON organizations (type);
CREATE INDEX IF NOT EXISTS "IDX_organizations_status" ON organizations (status);
CREATE INDEX IF NOT EXISTS "IDX_clients_status" ON clients (status);
CREATE INDEX IF NOT EXISTS "IDX_clients_complianceStatus" ON clients ("complianceStatus");
CREATE INDEX IF NOT EXISTS "IDX_clients_organizationId" ON clients ("organizationId");
CREATE INDEX IF NOT EXISTS "IDX_clients_isDeleted" ON clients ("isDeleted");

-- Add foreign key constraints
ALTER TABLE organizations 
    ADD CONSTRAINT "FK_organizations_parent" 
    FOREIGN KEY ("parentOrganizationId") 
    REFERENCES organizations(id) 
    ON DELETE SET NULL;

ALTER TABLE clients 
    ADD CONSTRAINT "FK_clients_organization" 
    FOREIGN KEY ("organizationId") 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE clients 
    ADD CONSTRAINT "FK_clients_parent" 
    FOREIGN KEY ("parentClientId") 
    REFERENCES clients(id) 
    ON DELETE SET NULL;

-- Insert test data
INSERT INTO organizations (id, name, type, status) 
VALUES 
    ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Overmatch Digital', 'msp', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (name, slug, "organizationId", status, "complianceStatus") 
VALUES 
    ('Test Client 1', 'test-client-1', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'active', 'in_progress'),
    ('Demo Company', 'demo-company', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'onboarding', 'not_started')
ON CONFLICT DO NOTHING;