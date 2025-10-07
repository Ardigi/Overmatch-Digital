// Mock for DOMPurify in E2E tests
const DOMPurify = (window) => ({
  sanitize: (content, options) => content || '',
});

module.exports = DOMPurify;
module.exports.default = DOMPurify;
