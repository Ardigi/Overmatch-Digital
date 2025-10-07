# Control Service Migration Guide

This guide helps you migrate to the latest Control Service API changes introduced on 2025-01-09.

## Overview

Several breaking changes were made to improve consistency and functionality in the Control Service. This guide provides step-by-step instructions to update your code.

## Breaking Changes

### 1. Framework Coverage Field Rename

The `getFrameworkCoverage` method now returns `coverage` instead of `coveragePercentage`.

#### Before
```typescript
const coverage = await controlsService.getFrameworkCoverage('org-123', 'SOC2');
console.log(coverage.coveragePercentage); // OLD field name
```

#### After
```typescript
const coverage = await controlsService.getFrameworkCoverage('org-123', 'SOC2');
console.log(coverage.coverage); // NEW field name
```

#### Response Structure Change
```typescript
// OLD Response
{
  framework: 'SOC2',
  totalControls: 100,
  implementedControls: 73,
  coveragePercentage: 73.0  // RENAMED
}

// NEW Response
{
  framework: 'SOC2',
  totalControls: 100,
  implementedControls: 73,
  coverage: 73.0  // NEW NAME
}
```

### 2. Remove Method Return Type

The `remove` method now returns the retired Control object instead of void.

#### Before
```typescript
// OLD: Returns void
await controlsService.remove('control-123');
// No return value to work with
```

#### After
```typescript
// NEW: Returns the retired Control
const retiredControl = await controlsService.remove('control-123');
console.log(retiredControl.status); // 'RETIRED'
console.log(retiredControl.id); // 'control-123'
```

#### Method Signature Change
```typescript
// OLD
async remove(id: string): Promise<void>

// NEW
async remove(id: string): Promise<Control>
```

### 3. Validate Framework Requirements Coverage Access

The `validateFrameworkRequirements` method now uses a flat coverage structure.

#### Before
```typescript
const validation = await controlsService.validateFrameworkRequirements('org-123', 'SOC2');
// Internal implementation used: coverage.overall.coveragePercentage
```

#### After
```typescript
const validation = await controlsService.validateFrameworkRequirements('org-123', 'SOC2');
// Internal implementation now uses: coverage.coverage
// API response unchanged, but internal logic fixed
```

## Migration Steps

### Step 1: Update Coverage Field References

Search your codebase for uses of `getFrameworkCoverage` and update field access:

```bash
# Find all occurrences
grep -r "coveragePercentage" --include="*.ts" --include="*.js"

# Update each occurrence from:
# coverage.coveragePercentage
# to:
# coverage.coverage
```

### Step 2: Handle Remove Method Return Value

Update code that calls the `remove` method to handle the returned Control:

```typescript
// Add type handling for the return value
try {
  const retiredControl = await controlsService.remove(controlId);
  
  // You can now verify the deletion
  if (retiredControl.status === ControlStatus.RETIRED) {
    console.log(`Control ${retiredControl.code} successfully retired`);
  }
  
  // Use the returned control for audit logging
  await auditLog.record({
    action: 'CONTROL_RETIRED',
    controlId: retiredControl.id,
    controlCode: retiredControl.code,
    timestamp: new Date()
  });
} catch (error) {
  // Handle errors (e.g., control has active implementations)
  console.error('Failed to remove control:', error.message);
}
```

### Step 3: Update TypeScript Interfaces

If you have TypeScript interfaces for these methods, update them:

```typescript
// Update your interfaces
interface FrameworkCoverageResponse {
  framework: string;
  totalControls: number;
  implementedControls: number;
  coverage: number; // Changed from coveragePercentage
}

interface ControlsServiceInterface {
  // Update remove method signature
  remove(id: string): Promise<Control>; // Changed from Promise<void>
}
```

### Step 4: Update Tests

Update your test expectations:

```typescript
// Framework coverage tests
it('should calculate framework coverage', async () => {
  const coverage = await service.getFrameworkCoverage('org-123', 'SOC2');
  
  // OLD
  // expect(coverage.coveragePercentage).toBe(73.0);
  
  // NEW
  expect(coverage.coverage).toBe(73.0);
});

// Remove method tests
it('should soft delete control', async () => {
  // NEW: Check the returned control
  const result = await service.remove('control-123');
  expect(result).toBeDefined();
  expect(result.status).toBe(ControlStatus.RETIRED);
});
```

## Testing Your Migration

After making these changes:

1. **Run unit tests** to ensure your code changes work:
   ```bash
   npm test
   ```

2. **Test framework coverage endpoints**:
   ```bash
   curl http://localhost:3004/controls/framework-coverage/SOC2/org-123
   # Check that response contains 'coverage' field
   ```

3. **Test remove functionality**:
   ```bash
   # Should return the retired control object
   curl -X DELETE http://localhost:3004/controls/control-123
   ```

## Rollback Plan

If you need to rollback these changes:

1. The previous version's behavior can be restored by reverting the Control Service to the commit before these changes
2. No database migrations are required - these are code-only changes
3. Ensure all services that depend on the Control Service are also rolled back

## Support

For questions or issues with this migration:

1. Check the [CHANGELOG.md](../CHANGELOG.md) for additional context
2. Review the Control Service tests for usage examples
3. Contact the platform team for assistance

## Timeline

- **Changes Released**: 2025-01-09
- **Backward Compatibility**: Not maintained - breaking changes
- **Required Migration By**: Before next production deployment
- **Support for Old API**: Discontinued immediately