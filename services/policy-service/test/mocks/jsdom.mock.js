// Mock for jsdom in E2E tests
const JSDOM = class {
  constructor(html = '') {
    this.window = {
      document: {},
      location: {},
      navigator: {},
    };
  }
};

module.exports = { JSDOM };
module.exports.JSDOM = JSDOM;
