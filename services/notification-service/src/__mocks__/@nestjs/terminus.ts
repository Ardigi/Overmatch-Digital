// Mock @nestjs/terminus
export const TerminusModule = {
  forRoot: jest.fn().mockReturnValue({
    module: 'TerminusModule',
    imports: [],
    providers: [],
    exports: [],
  }),
};

// Mock decorator
export const HealthCheck = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    return descriptor;
  };
};

export class HealthCheckService {
  check = jest.fn().mockResolvedValue({
    status: 'ok',
    info: {},
    error: {},
    details: {},
  });
}

export class TypeOrmHealthIndicator {
  pingCheck = jest.fn().mockResolvedValue({
    database: {
      status: 'up',
    },
  });
}

export class HttpHealthIndicator {
  pingCheck = jest.fn().mockResolvedValue({
    http: {
      status: 'up',
    },
  });
}

export class MemoryHealthIndicator {
  checkHeap = jest.fn().mockResolvedValue({
    memory_heap: {
      status: 'up',
    },
  });

  checkRSS = jest.fn().mockResolvedValue({
    memory_rss: {
      status: 'up',
    },
  });
}

export class DiskHealthIndicator {
  checkStorage = jest.fn().mockResolvedValue({
    storage: {
      status: 'up',
    },
  });
}
