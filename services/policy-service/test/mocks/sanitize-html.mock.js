// E2E test mock for sanitize-html
const sanitizeHtml = (content, options) => {
  // In E2E tests, we just return the content as-is
  // This avoids the "sanitizeHtml is not a function" error
  return content || '';
};

// Add defaults property
sanitizeHtml.defaults = {
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

// Export for both CommonJS and ES modules
module.exports = sanitizeHtml;
module.exports.default = sanitizeHtml;

// Support "import * as sanitizeHtml" syntax
module.exports.sanitizeHtml = sanitizeHtml;
