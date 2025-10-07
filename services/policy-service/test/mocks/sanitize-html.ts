// E2E test mock for sanitize-html TypeScript
const sanitizeHtml = (content: string, options?: any): string => {
  // In E2E tests, we just return the content as-is
  // This avoids the "sanitizeHtml is not a function" error
  return content || '';
};

// Add defaults property
(sanitizeHtml as any).defaults = {
  allowedTags: [
    'p',
    'br',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'a',
  ],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'target'],
  },
};

export = sanitizeHtml;
