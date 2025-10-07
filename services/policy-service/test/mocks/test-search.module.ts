import { Module } from '@nestjs/common';
import { SearchService } from '../../src/modules/search/search.service';

const mockSearchService = {
  index: jest.fn().mockResolvedValue({ _id: 'test-id' }),
  update: jest.fn().mockResolvedValue({ _id: 'test-id' }),
  delete: jest.fn().mockResolvedValue({ acknowledged: true }),
  search: jest.fn().mockResolvedValue({
    hits: {
      total: { value: 0 },
      hits: [],
    },
  }),
  bulkIndex: jest.fn().mockResolvedValue({ items: [] }),
  createIndex: jest.fn().mockResolvedValue({ acknowledged: true }),
  deleteIndex: jest.fn().mockResolvedValue({ acknowledged: true }),
  reindex: jest.fn().mockResolvedValue({ took: 0, errors: false }),
};

@Module({
  providers: [
    {
      provide: SearchService,
      useValue: mockSearchService,
    },
  ],
  exports: [SearchService],
})
export class TestSearchModule {}
