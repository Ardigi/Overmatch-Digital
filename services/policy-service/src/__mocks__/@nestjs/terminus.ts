export class HealthCheckService {
  check = jest.fn();
}

export class TypeOrmHealthIndicator {
  pingCheck = jest.fn();
}

export class HttpHealthIndicator {
  pingCheck = jest.fn();
}

export class DiskHealthIndicator {
  checkStorage = jest.fn();
}

export class MemoryHealthIndicator {
  checkHeap = jest.fn();
  checkRSS = jest.fn();
}

// Decorator mocks
export const HealthCheck =
  () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    return descriptor;
  };

export const HealthCheckResult = {
  up: (key: string, data?: any) => ({ [key]: { status: 'up', ...data } }),
  down: (key: string, data?: any) => ({ [key]: { status: 'down', ...data } }),
};
