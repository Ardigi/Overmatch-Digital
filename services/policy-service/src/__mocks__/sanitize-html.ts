// Mock for sanitize-html module
const sanitizeHtml = jest.fn((content: string) => content);

// Add defaults property
(sanitizeHtml as any).defaults = {
  allowedTags: ['p', 'br', 'span', 'div'],
  allowedAttributes: {
    '*': ['style'],
  },
};

// Export as both default and namespace
export = sanitizeHtml;
