import { Transform } from 'class-transformer';

/**
 * Sanitizes HTML and dangerous content from string values
 * Removes or escapes potentially dangerous characters and patterns
 */
export function Sanitize() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    let sanitized = value;

    // Step 1: Remove complete script tags and their content
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');

    // Step 2: Remove all remaining HTML tags
    sanitized = sanitized.replace(/<[^>]+>/g, '');

    // Step 3: Handle SQL injection patterns
    // Remove SQL keywords but keep other text
    sanitized = sanitized.replace(
      /\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|CREATE|ALTER|EXEC|EXECUTE)\b/gi,
      ''
    );

    // Remove SQL comment markers
    sanitized = sanitized.replace(/-{2,}/g, '');

    // Remove semicolons (SQL statement separators)
    sanitized = sanitized.replace(/;/g, '');

    // Step 4: Handle template injection patterns
    // Remove ${} but keep content
    sanitized = sanitized.replace(/\$\{([^}]*)\}/g, '$1');

    // Remove {{}} but keep content
    sanitized = sanitized.replace(/\{\{([^}]*)\}\}/g, '$1');

    // Remove parentheses and quotes from potential code execution
    sanitized = sanitized.replace(/[()'"]/g, '');

    // Step 5: Clean up extra whitespace
    // Replace multiple spaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Trim whitespace from beginning and end
    sanitized = sanitized.trim();

    // If the sanitized string is empty, return the original value
    // to let validation handle it (e.g., @IsNotEmpty will catch it)
    // This prevents the sanitizer from causing validation failures
    if (sanitized === '' && value !== '') {
      // Return a placeholder to indicate sanitized content
      return '[SANITIZED]';
    }

    return sanitized;
  });
}

/**
 * Trims whitespace from string values
 */
export function Trim() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    return value.trim();
  });
}
