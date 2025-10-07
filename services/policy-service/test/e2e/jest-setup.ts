// Jest setup for E2E tests
import 'reflect-metadata';

// Mock sanitize-html module before any application code is loaded
jest.mock('sanitize-html', () => {
  const mockFunction = (content: string, options?: any): string => {
    return content || '';
  };

  // Set up the module to work with both default export and namespace import
  const mockModule = mockFunction;
  (mockModule as any).default = mockFunction;
  (mockModule as any).defaults = {
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

  return mockModule;
});

// Also ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');
