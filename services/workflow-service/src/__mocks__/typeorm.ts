// Mock for TypeORM to avoid connection issues in tests
export const getRepositoryToken = (entity: any) => `${entity.name}Repository`;

export const TypeOrmModule = {
  forRoot: () => ({
    module: class MockTypeOrmRootModule {},
    providers: [],
    exports: [],
  }),
  forFeature: (entities: any[]) => ({
    module: class MockTypeOrmFeatureModule {},
    providers: entities.map((entity) => ({
      provide: getRepositoryToken(entity),
      useValue: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getMany: jest.fn(),
          getOne: jest.fn(),
          getManyAndCount: jest.fn(),
        })),
      },
    })),
    exports: entities.map((entity) => getRepositoryToken(entity)),
  }),
};

export const InjectRepository =
  (entity: any) => (target: any, key: string | symbol, index?: number) => {
    // This is a decorator, so it doesn't need to do anything in the mock
  };

// Export common decorators that might be used
export const Entity = () => (target: any) => target;
export const PrimaryGeneratedColumn = () => (target: any, key: string) => {};
export const Column = (options?: any) => (target: any, key: string) => {};
export const CreateDateColumn = () => (target: any, key: string) => {};
export const UpdateDateColumn = () => (target: any, key: string) => {};
export const ManyToOne = () => (target: any, key: string) => {};
export const OneToMany = () => (target: any, key: string) => {};
export const JoinColumn = () => (target: any, key: string) => {};
export const Index = () => (target: any) => target;
export const VersionColumn = () => (target: any, key: string) => {};
