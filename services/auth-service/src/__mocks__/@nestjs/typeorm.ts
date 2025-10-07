// Mock for @nestjs/typeorm
export const TypeOrmModule = {
  forRoot: jest.fn(() => ({
    module: 'TypeOrmModule',
    providers: [],
    exports: [],
  })),
  forRootAsync: jest.fn(() => ({
    module: 'TypeOrmModule',
    providers: [],
    exports: [],
  })),
  forFeature: jest.fn(() => ({
    module: 'TypeOrmModule',
    providers: [],
    exports: [],
  })),
};

export const InjectRepository = jest.fn(() => (target: any, key: string, index?: number) => {});
export const InjectDataSource = jest.fn(() => (target: any, key: string, index?: number) => {});
export const InjectEntityManager = jest.fn(() => (target: any, key: string, index?: number) => {});
