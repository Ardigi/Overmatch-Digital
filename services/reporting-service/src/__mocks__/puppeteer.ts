const mockPage = {
  goto: jest.fn(),
  setContent: jest.fn(),
  emulateMediaType: jest.fn(),
  pdf: jest.fn(() => Buffer.from('mock pdf content')),
  screenshot: jest.fn(() => Buffer.from('mock screenshot')),
  close: jest.fn(),
  evaluate: jest.fn(),
  waitForSelector: jest.fn(),
  $: jest.fn(),
  $$: jest.fn(),
  click: jest.fn(),
  type: jest.fn(),
  waitForNavigation: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn(() => mockPage),
  close: jest.fn(),
  version: jest.fn(() => 'HeadlessChrome/100.0.0.0'),
  pages: jest.fn(() => [mockPage]),
};

export const launch = jest.fn(() => Promise.resolve(mockBrowser));

export default {
  launch,
};
