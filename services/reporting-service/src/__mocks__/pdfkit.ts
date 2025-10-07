class MockPDFDocument {
  pipe = jest.fn().mockReturnThis();
  text = jest.fn().mockReturnThis();
  fontSize = jest.fn().mockReturnThis();
  font = jest.fn().mockReturnThis();
  moveDown = jest.fn().mockReturnThis();
  moveTo = jest.fn().mockReturnThis();
  lineTo = jest.fn().mockReturnThis();
  stroke = jest.fn().mockReturnThis();
  rect = jest.fn().mockReturnThis();
  fill = jest.fn().mockReturnThis();
  image = jest.fn().mockReturnThis();
  addPage = jest.fn().mockReturnThis();
  end = jest.fn();
  on = jest.fn((event, callback) => {
    if (event === 'end') {
      setTimeout(() => callback(), 0);
    }
    return this;
  });
}

export default MockPDFDocument;
