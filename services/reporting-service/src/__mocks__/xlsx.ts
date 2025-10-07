export const utils = {
  json_to_sheet: jest.fn(() => ({})),
  sheet_to_json: jest.fn(() => []),
  book_new: jest.fn(() => ({ SheetNames: [], Sheets: {} })),
  book_append_sheet: jest.fn(),
  sheet_add_aoa: jest.fn(),
  decode_range: jest.fn(() => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } })),
  encode_cell: jest.fn(() => 'A1'),
  format_cell: jest.fn(),
  aoa_to_sheet: jest.fn(() => ({})),
};

export const write = jest.fn(() => Buffer.from('mock excel content'));
export const writeFile = jest.fn();
export const read = jest.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }));
export const readFile = jest.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }));

export default {
  utils,
  write,
  writeFile,
  read,
  readFile,
};
