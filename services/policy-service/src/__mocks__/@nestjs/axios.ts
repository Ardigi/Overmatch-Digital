import { of } from 'rxjs';

export class HttpService {
  get = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
  post = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
  put = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
  delete = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
  patch = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
  head = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
  request = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
}

// Create a mock module object to avoid circular reference
const MockHttpModule = {
  register: jest.fn(),
  registerAsync: jest.fn(),
};

// Set up the mock return values after creation
MockHttpModule.register.mockReturnValue({
  module: MockHttpModule,
  providers: [HttpService],
  exports: [HttpService],
});

MockHttpModule.registerAsync.mockReturnValue({
  module: MockHttpModule,
  providers: [HttpService],
  exports: [HttpService],
});

export const HttpModule = MockHttpModule;
