// Mock for isomorphic-dompurify to avoid LRUCache constructor error in tests
// This mock provides the same API but bypasses the jsdom dependency chain

const DOMPurify = {
  sanitize: jest.fn((content, options) => {
    // Simple sanitization mock - just return the content
    // In tests, we don't need actual XSS protection
    if (typeof content !== 'string') {
      return String(content);
    }
    
    // Remove script tags for basic safety in tests
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }),
  
  isSupported: true,
  
  version: '2.3.0',
  
  removed: [],
  
  // Add common DOMPurify methods
  addHook: jest.fn(),
  removeHook: jest.fn(),
  removeHooks: jest.fn(),
  removeAllHooks: jest.fn(),
  setConfig: jest.fn(),
  clearConfig: jest.fn(),
};

// Export as default and named export for compatibility
module.exports = DOMPurify;
module.exports.default = DOMPurify;