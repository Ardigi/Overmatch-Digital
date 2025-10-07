export class TerminusModule {
  static forRoot() {
    return {
      module: TerminusModule,
      imports: [],
      providers: [],
      exports: [],
    };
  }
}

export const HealthCheckService = jest.fn().mockImplementation(() => ({
  check: jest.fn().mockResolvedValue({ status: 'ok', details: {} }),
}));

export const TypeOrmHealthIndicator = jest.fn().mockImplementation(() => ({
  pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
}));

export const HealthCheck = jest.fn(
  () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    return descriptor;
  }
);

export const HealthCheckResult = jest.fn();
