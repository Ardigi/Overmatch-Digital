import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';

/**
 * Test sanitization pipe that passes values through unchanged.
 * This prevents UUID corruption during E2E testing while maintaining
 * the same interface as the production SanitizationPipe.
 */
@Injectable()
export class TestSanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Pass through all values unchanged to preserve UUIDs and test data integrity
    return value;
  }
}

/**
 * Test policy content sanitization pipe that passes values through unchanged.
 * This prevents content corruption during E2E testing while maintaining
 * the same interface as the production PolicyContentSanitizationPipe.
 */
@Injectable()
export class TestPolicyContentSanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Pass through all values unchanged to preserve policy content integrity in tests
    return value;
  }
}
