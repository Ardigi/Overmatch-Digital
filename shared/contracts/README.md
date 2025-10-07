# Service Response Types

This document outlines the comprehensive TypeScript interfaces created for service responses across the SOC Compliance Platform.

## Overview

The `service-responses.ts` file contains strongly-typed interfaces for all service response types, eliminating the need for `ServiceResponse<unknown>` and providing full type safety for inter-service communication.

## Core Response Interfaces

### Base Types
- `BaseServiceData` - Common fields for all service responses
- `ErrorResponse` - Standardized error response structure
- `ValidationErrorResponse` - Field-specific validation errors

### Organization & Client Service
- `OrganizationResponse` - Organization/client data from client-service
- `UserProfileResponse` - User profile with permissions and preferences

### Control Service
- `PaginatedControlsResponse` - Paginated controls list
- `BulkControlsResponse` - Non-paginated controls bulk response
- `ControlSummaryResponse` - Control summary for dashboards/reporting
- `ControlMetricsResponse` - Control-related metrics

### Audit Service
- `AuditFinding` - Complete audit finding interface
- `PaginatedFindingsResponse` - Paginated findings list
- `AuditFindingsSummaryResponse` - Findings summary for reporting
- `AuditMetricsResponse` - Audit-related metrics

### Evidence Service
- `PaginatedEvidenceResponse` - Paginated evidence list
- `EvidenceCountResponse` - Evidence count with breakdown
- `EvidenceMetricsResponse` - Evidence-related metrics

### Policy Service
- `PolicyComplianceResponse` - Policy compliance with overall score
- `PolicyMetricsResponse` - Policy-related metrics

### Cross-Service Types
- `MetricsResponse` - Generic metrics response for reporting
- `DashboardResponse` - Comprehensive dashboard data
- `ProjectProgressResponse` - Project progress tracking

## Usage in Reporting Service

The reporting service now uses strongly-typed service calls:

```typescript
// Before (problematic)
const response = await this.serviceDiscovery.callService('control-service', 'GET', '/api/controls');
const controls = response.data?.items || []; // TypeScript error: unknown type

// After (type-safe)
const response: ServiceResponse<PaginatedControlsResponse> = await this.serviceDiscovery.callService(
  'control-service', 
  'GET', 
  '/api/controls'
);
const controls = response.data?.items || []; // Fully typed as Control[]
```

## Key Benefits

1. **Type Safety** - Eliminates `ServiceResponse<unknown>` usage
2. **IntelliSense** - Full autocomplete for response properties
3. **Compile-time Validation** - Catches type errors at build time
4. **Consistency** - Standardized response structures across services
5. **Documentation** - Self-documenting API contracts

## Service Compatibility Matrix

| Service | Response Types | Status |
|---------|---------------|--------|
| Control Service | `PaginatedControlsResponse`, `ControlSummaryResponse`, `ControlMetricsResponse` | ✅ Implemented |
| Audit Service | `PaginatedFindingsResponse`, `AuditFindingsSummaryResponse`, `AuditMetricsResponse` | ✅ Implemented |
| Evidence Service | `PaginatedEvidenceResponse`, `EvidenceCountResponse`, `EvidenceMetricsResponse` | ✅ Implemented |
| Policy Service | `PolicyComplianceResponse`, `PolicyMetricsResponse` | ✅ Implemented |
| Client Service | `OrganizationResponse` | ✅ Implemented |
| Reporting Service | Uses all above types | ✅ Updated |

## Migration Guide

For other services that need to adopt these response types:

1. Import the required response interfaces:
   ```typescript
   import { PaginatedControlsResponse, ControlSummaryResponse } from '@soc-compliance/contracts';
   ```

2. Type your service calls:
   ```typescript
   const response: ServiceResponse<PaginatedControlsResponse> = await this.serviceDiscovery.callService(...);
   ```

3. Replace any `ServiceResponse<unknown>` with the appropriate concrete type

4. Update your controllers to return properly typed responses

## Building and Testing

To verify types compile correctly:

```bash
# Build shared contracts
npm run build --workspace=@soc-compliance/contracts

# Build reporting service (uses the new types)
cd services/reporting-service && npm run build

# Run TypeScript type checking
cd services/reporting-service && npx tsc --noEmit
```

## Future Enhancements

- Add response types for remaining services as needed
- Consider creating request type interfaces
- Add OpenAPI/Swagger generation from these types
- Implement response validation decorators