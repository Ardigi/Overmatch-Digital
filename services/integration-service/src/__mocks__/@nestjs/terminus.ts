// Mock for @nestjs/terminus
export const TerminusModule = {
  forRoot: jest.fn().mockReturnValue({
    module: 'TerminusModule',
    imports: [],
    providers: [],
    exports: [],
  }),
};

export const HealthCheckService = jest.fn();
export const TypeOrmHealthIndicator = jest.fn();
export const HealthCheck = () => (target: any, key: string, descriptor: any) => descriptor;
export const HealthCheckResult = jest.fn();
export const HealthIndicatorResult = jest.fn();
