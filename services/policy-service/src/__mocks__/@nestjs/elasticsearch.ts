export class ElasticsearchService {
  index = jest.fn().mockResolvedValue({ _id: 'test-id' });
  search = jest.fn().mockResolvedValue({
    hits: {
      hits: [],
      total: { value: 0 },
    },
  });
  update = jest.fn().mockResolvedValue({ _id: 'test-id' });
  delete = jest.fn().mockResolvedValue({ acknowledged: true });
  indices = {
    exists: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ acknowledged: true }),
    delete: jest.fn().mockResolvedValue({ acknowledged: true }),
  };
}

// Create a mock module object to avoid circular reference
const MockElasticsearchModule = {
  register: jest.fn(),
  registerAsync: jest.fn(),
};

// Set up the mock return values after creation
MockElasticsearchModule.register.mockReturnValue({
  module: MockElasticsearchModule,
  providers: [ElasticsearchService],
  exports: [ElasticsearchService],
});

MockElasticsearchModule.registerAsync.mockReturnValue({
  module: MockElasticsearchModule,
  providers: [ElasticsearchService],
  exports: [ElasticsearchService],
});

export const ElasticsearchModule = MockElasticsearchModule;
