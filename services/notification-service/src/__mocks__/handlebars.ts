export const compile = jest.fn().mockImplementation((template: string) => {
  // Return a function that does simple variable substitution
  return jest.fn().mockImplementation((variables: any) => {
    let result = template;
    Object.keys(variables || {}).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, variables[key]);
    });
    return result;
  });
});

export const registerHelper = jest.fn();
export const registerPartial = jest.fn();
export const unregisterHelper = jest.fn();
export const unregisterPartial = jest.fn();
export const create = jest.fn().mockReturnValue({
  compile: compile,
  registerHelper: registerHelper,
  registerPartial: registerPartial,
  unregisterHelper: unregisterHelper,
  unregisterPartial: unregisterPartial,
});

export const SafeString = jest.fn().mockImplementation((str: string) => ({
  toString: () => str,
}));

export const escapeExpression = jest.fn().mockImplementation((str: string) => str);

export const Utils = {
  escapeExpression,
};

export const VERSION = '4.7.7';

export const templates = {};
export const partials = {};
export const helpers = {};

// TemplateDelegate type for TypeScript
export type TemplateDelegate<T = any> = (context: T, options?: any) => string;

// Default export
const handlebars = {
  compile,
  registerHelper,
  registerPartial,
  unregisterHelper,
  unregisterPartial,
  create,
  SafeString,
  escapeExpression,
  Utils,
  VERSION,
  templates,
  partials,
  helpers,
};

export default handlebars;
