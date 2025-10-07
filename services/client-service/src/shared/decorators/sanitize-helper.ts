// HTML entity map for escaping
export const htmlEntityMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

// Function to escape HTML entities
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, (char) => htmlEntityMap[char] || char);
}

// Function to strip dangerous HTML
export function stripDangerousHtml(value: string): string {
  let sanitized = value;

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove vbscript: protocol
  sanitized = sanitized.replace(/vbscript:/gi, '');

  // Remove dangerous tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
  sanitized = sanitized.replace(/<meta\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove dangerous attributes
  sanitized = sanitized.replace(/\s*(style|class|id)\s*=\s*["'][^"']*["']/gi, '');

  // Clean up HTML comments
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

  return sanitized;
}
