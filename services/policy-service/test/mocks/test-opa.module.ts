import { Module } from '@nestjs/common';
import { OpaService } from '../../src/modules/opa/opa.service';

const mockOpaService = {
  evaluate: jest.fn().mockResolvedValue({
    result: {
      allow: true,
      reasons: ['Test policy allows action'],
    },
  }),
  checkPolicy: jest.fn().mockResolvedValue(true),
  getPolicies: jest.fn().mockResolvedValue([]),
  uploadPolicy: jest.fn().mockResolvedValue({ success: true }),
  deletePolicy: jest.fn().mockResolvedValue({ success: true }),
};

@Module({
  providers: [
    {
      provide: OpaService,
      useValue: mockOpaService,
    },
  ],
  exports: [OpaService],
})
export class TestOpaModule {}
