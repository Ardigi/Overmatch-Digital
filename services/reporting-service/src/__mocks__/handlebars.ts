export const compile = jest.fn(() => jest.fn(() => '<html>Mock rendered content</html>'));
export const registerHelper = jest.fn();
export const registerPartial = jest.fn();
export const SafeString = jest.fn((str) => str);

export default {
  compile,
  registerHelper,
  registerPartial,
  SafeString,
};
