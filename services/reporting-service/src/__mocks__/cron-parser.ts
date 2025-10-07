const mockExpression = {
  next: jest.fn(() => ({
    toDate: jest.fn(() => new Date(Date.now() + 86400000)), // Tomorrow
    toString: jest.fn(() => new Date(Date.now() + 86400000).toISOString()),
  })),
  prev: jest.fn(() => ({
    toDate: jest.fn(() => new Date(Date.now() - 86400000)), // Yesterday
    toString: jest.fn(() => new Date(Date.now() - 86400000).toISOString()),
  })),
  hasNext: jest.fn(() => true),
  hasPrev: jest.fn(() => true),
  iterate: jest.fn(function* () {
    yield new Date();
  }),
  reset: jest.fn(),
  fields: {},
};

export const parseExpression = jest.fn(() => mockExpression);
export const parseString = jest.fn(() => mockExpression);
export const parseFile = jest.fn(() => [mockExpression]);

export default {
  parseExpression,
  parseString,
  parseFile,
};
