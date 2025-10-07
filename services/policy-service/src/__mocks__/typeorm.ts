// Manual mock for TypeORM to avoid import issues in tests
export const getRepository = jest.fn();
export const createConnection = jest.fn();
export const getConnection = jest.fn();

// Decorator mocks
export const Entity = (name?: string) => (target: any) => {
  // Don't modify the target, just return it
  return target;
};
export const Column = () => (target: any, key: string) => {};
export const PrimaryGeneratedColumn = () => (target: any, key: string) => {};
export const ManyToOne = () => (target: any, key: string) => {};
export const OneToMany = () => (target: any, key: string) => {};
export const JoinColumn = () => (target: any, key: string) => {};
export const CreateDateColumn = () => (target: any, key: string) => {};
export const UpdateDateColumn = () => (target: any, key: string) => {};
export const DeleteDateColumn = () => (target: any, key: string) => {};
export const Index = () => (target: any, key?: string) => {};
export const Unique = () => (target: any, key?: string) => {};
export const BeforeInsert = () => (target: any, key: string) => {};
export const BeforeUpdate = () => (target: any, key: string) => {};
export const ManyToMany = () => (target: any, key: string) => {};
export const JoinTable = () => (target: any, key: string) => {};
export const Check = () => (target: any, key?: string) => {};

// Other exports
export class Repository<T> {}
export class DataSource {}
export class SelectQueryBuilder<T> {}
export class FindOptionsWhere {}

// TypeORM operators
export const In = jest.fn((values: any[]) => ({ in: values }));
export const IsNull = jest.fn(() => ({ isNull: true }));
export const Not = jest.fn((value: any) => ({ not: value }));

// Query builder functions
export const Between = jest.fn((from: any, to: any) => ({ from, to }));
export const LessThanOrEqual = jest.fn((value: any) => ({ lessThanOrEqual: value }));
export const Like = jest.fn((value: any) => ({ like: value }));

// Additional TypeORM exports for policy service
export const InjectRepository = (entity: any) => (target: any, key: string, index: number) => {};
export const getRepositoryToken = (entity: any) => `${entity.name}Repository`;

// Mock TypeOrmModule
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
