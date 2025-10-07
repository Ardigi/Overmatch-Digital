import { createHash } from 'crypto';

/**
 * Utility functions for consistent cache key generation
 * Follows 2025 best practices for Redis key naming conventions
 */

/**
 * Maximum cache key length to avoid Redis performance issues
 */
const MAX_KEY_LENGTH = 250;

/**
 * Hash threshold - if key exceeds this length, we'll use a hash
 */
const HASH_THRESHOLD = 150;

/**
 * Generate a consistent cache key with hierarchical namespace structure
 * Format: service:className:methodName[:parameters]
 *
 * @param options - Cache key generation options
 * @returns Formatted cache key
 */
export function generateCacheKey(options: {
  service?: string;
  className: string;
  methodName: string;
  parameters?: any[];
  customKey?: string;
}): string {
  const { service, className, methodName, parameters = [], customKey } = options;

  const parts: string[] = [];

  // Add service prefix if provided
  if (service) {
    parts.push(service);
  }

  parts.push(className, methodName);

  // Use custom key if provided
  if (customKey) {
    parts.push(customKey);
  } else if (parameters.length > 0) {
    // Generate parameter-based key
    const paramKey = generateParameterKey(parameters);
    if (paramKey) {
      parts.push(paramKey);
    }
  }

  const key = parts.join(':');

  // If key is too long, use hash-based approach
  if (key.length > MAX_KEY_LENGTH) {
    return generateHashedKey(options);
  }

  return key;
}

/**
 * Generate a parameter-based cache key segment
 * Handles complex objects and arrays safely
 *
 * @param parameters - Method parameters array
 * @returns Serialized parameter string or null
 */
export function generateParameterKey(parameters: any[]): string | null {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  try {
    // Filter out functions and undefined values
    const cleanParams = parameters.map((param) => {
      if (typeof param === 'function') {
        return '[Function]';
      }
      if (param === undefined) {
        return null;
      }
      if (param === null) {
        return null;
      }
      // Handle circular references and complex objects
      return JSON.parse(JSON.stringify(param));
    });

    const paramString = JSON.stringify(cleanParams);

    // If parameter string is too long, hash it
    if (paramString.length > HASH_THRESHOLD) {
      return createHash('sha256').update(paramString).digest('hex').substring(0, 16);
    }

    // URL-safe encoding for parameter values
    return Buffer.from(paramString)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    // Fallback to hash if JSON serialization fails
    const fallbackString = parameters.map((p) => String(p)).join('|');
    return createHash('sha256').update(fallbackString).digest('hex').substring(0, 16);
  }
}

/**
 * Generate a hash-based cache key for long keys
 * Maintains readability while ensuring uniqueness
 *
 * @param options - Cache key generation options
 * @returns Hashed cache key
 */
export function generateHashedKey(options: {
  service?: string;
  className: string;
  methodName: string;
  parameters?: any[];
  customKey?: string;
}): string {
  const { service, className, methodName, parameters = [], customKey } = options;

  // Create readable prefix
  const prefix = service ? `${service}:${className}:${methodName}` : `${className}:${methodName}`;

  // Create hash input
  const hashInput = JSON.stringify({
    service,
    className,
    methodName,
    parameters,
    customKey,
    timestamp: Date.now(), // Ensure uniqueness
  });

  const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);

  return `${prefix}:${hash}`;
}

/**
 * Generate cache key for tag-based invalidation
 * Used for grouping related cache entries
 *
 * @param tag - Tag identifier
 * @param identifier - Optional specific identifier
 * @returns Tag-based cache key
 */
export function generateTagKey(tag: string, identifier?: string): string {
  const parts = ['tag', tag];

  if (identifier) {
    parts.push(identifier);
  }

  return parts.join(':');
}

/**
 * Generate wildcard pattern for cache key matching
 * Used for bulk operations and pattern-based eviction
 *
 * @param options - Pattern generation options
 * @returns Redis-compatible wildcard pattern
 */
export function generateKeyPattern(options: {
  service?: string;
  className?: string;
  methodName?: string;
  tag?: string;
}): string {
  const { service, className, methodName, tag } = options;

  if (tag) {
    return `tag:${tag}:*`;
  }

  const parts: string[] = [];

  if (service) {
    parts.push(service);
  } else {
    parts.push('*');
  }

  if (className) {
    parts.push(className);
  } else {
    parts.push('*');
  }

  if (methodName) {
    parts.push(methodName);
  } else {
    parts.push('*');
  }

  parts.push('*');

  return parts.join(':');
}

/**
 * Validate cache key format and length
 * Ensures key follows Redis best practices
 *
 * @param key - Cache key to validate
 * @returns Validation result
 */
export function validateCacheKey(key: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!key || key.trim().length === 0) {
    issues.push('Cache key cannot be empty');
  }

  if (key.length > MAX_KEY_LENGTH) {
    issues.push(`Cache key exceeds maximum length of ${MAX_KEY_LENGTH} characters`);
  }

  // Check for invalid characters
  const invalidChars = /[<>:"\\|?*\s]/;
  if (invalidChars.test(key)) {
    issues.push('Cache key contains invalid characters');
  }

  // Check for Redis command keywords (basic check)
  const redisCommands = ['GET', 'SET', 'DEL', 'EXISTS', 'EXPIRE', 'TTL'];
  if (redisCommands.includes(key.toUpperCase())) {
    issues.push('Cache key conflicts with Redis command');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Normalize cache key to ensure consistency
 * Applies standard formatting rules
 *
 * @param key - Raw cache key
 * @returns Normalized cache key
 */
export function normalizeCacheKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
