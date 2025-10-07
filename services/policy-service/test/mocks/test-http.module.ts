import { HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { of } from 'rxjs';

const mockHttpService = {
  get: jest.fn().mockReturnValue(of({ data: {} })),
  post: jest.fn().mockReturnValue(of({ data: {} })),
  put: jest.fn().mockReturnValue(of({ data: {} })),
  patch: jest.fn().mockReturnValue(of({ data: {} })),
  delete: jest.fn().mockReturnValue(of({ data: {} })),
  head: jest.fn().mockReturnValue(of({ data: {} })),
  request: jest.fn().mockReturnValue(of({ data: {} })),
};

@Module({
  providers: [
    {
      provide: HttpService,
      useValue: mockHttpService,
    },
  ],
  exports: [HttpService],
})
export class TestHttpModule {}
