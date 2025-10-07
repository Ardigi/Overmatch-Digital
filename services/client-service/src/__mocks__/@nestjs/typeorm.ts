// Manual mock for @nestjs/typeorm
export const TypeOrmModule = {
  forRoot: jest.fn(() => ({
    module: class MockTypeOrmRootModule {},
  })),
  forFeature: jest.fn(() => ({
    module: class MockTypeOrmFeatureModule {},
    exports: [],
    providers: [],
  })),
};

export const InjectRepository = () => (target: any, key: string, index?: number) => {};
export const getRepositoryToken = (entity: any) => `${entity.name}Repository`;
export const InjectDataSource = () => (target: any, key: string, index?: number) => {};
export const InjectEntityManager = () => (target: any, key: string, index?: number) => {};
