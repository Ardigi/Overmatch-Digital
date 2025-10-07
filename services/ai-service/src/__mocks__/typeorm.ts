// Mock TypeORM decorators and functions
export const Entity = jest.fn(() => (target: any) => target);
export const PrimaryGeneratedColumn = jest.fn(() => (target: any, key: string) => {});
export const Column = jest.fn(() => (target: any, key: string) => {});
export const CreateDateColumn = jest.fn(() => (target: any, key: string) => {});
export const UpdateDateColumn = jest.fn(() => (target: any, key: string) => {});
export const DeleteDateColumn = jest.fn(() => (target: any, key: string) => {});
export const BeforeInsert = jest.fn(() => (target: any, key: string) => {});
export const BeforeUpdate = jest.fn(() => (target: any, key: string) => {});
export const AfterLoad = jest.fn(() => (target: any, key: string) => {});
export const Index = jest.fn(() => (target: any, key?: string) => {});
export const Unique = jest.fn(() => (target: any, key?: string) => {});
export const OneToOne = jest.fn(() => (target: any, key: string) => {});
export const OneToMany = jest.fn(() => (target: any, key: string) => {});
export const ManyToOne = jest.fn(() => (target: any, key: string) => {});
export const ManyToMany = jest.fn(() => (target: any, key: string) => {});
export const JoinColumn = jest.fn(() => (target: any, key: string) => {});
export const JoinTable = jest.fn(() => (target: any, key: string) => {});
export const RelationId = jest.fn(() => (target: any, key: string) => {});
export const Check = jest.fn(() => (target: any) => target);

// Mock TypeORM operators
export const In = jest.fn((values: any[]) => ({ _type: 'in', _value: values }));
export const Not = jest.fn((value: any) => ({ _type: 'not', _value: value }));
export const LessThan = jest.fn((value: any) => ({ _type: 'lessThan', _value: value }));
export const LessThanOrEqual = jest.fn((value: any) => ({
  _type: 'lessThanOrEqual',
  _value: value,
}));
export const MoreThan = jest.fn((value: any) => ({ _type: 'moreThan', _value: value }));
export const MoreThanOrEqual = jest.fn((value: any) => ({
  _type: 'moreThanOrEqual',
  _value: value,
}));
export const Equal = jest.fn((value: any) => ({ _type: 'equal', _value: value }));
export const Like = jest.fn((value: any) => ({ _type: 'like', _value: value }));
export const Between = jest.fn((from: any, to: any) => ({
  _type: 'between',
  _from: from,
  _to: to,
}));
export const IsNull = jest.fn(() => ({ _type: 'isNull' }));
export const Raw = jest.fn((value: any) => ({ _type: 'raw', _value: value }));

// Mock connection and repository
export const Repository = jest.fn(() => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(),
}));

export const getRepository = jest.fn();
export const getManager = jest.fn();
export const getConnection = jest.fn();

// Mock QueryBuilder
export class SelectQueryBuilder {
  where = jest.fn().mockReturnThis();
  andWhere = jest.fn().mockReturnThis();
  orWhere = jest.fn().mockReturnThis();
  leftJoin = jest.fn().mockReturnThis();
  leftJoinAndSelect = jest.fn().mockReturnThis();
  innerJoin = jest.fn().mockReturnThis();
  innerJoinAndSelect = jest.fn().mockReturnThis();
  orderBy = jest.fn().mockReturnThis();
  addOrderBy = jest.fn().mockReturnThis();
  skip = jest.fn().mockReturnThis();
  take = jest.fn().mockReturnThis();
  limit = jest.fn().mockReturnThis();
  offset = jest.fn().mockReturnThis();
  getMany = jest.fn();
  getOne = jest.fn();
  getManyAndCount = jest.fn();
  getCount = jest.fn();
  getRawMany = jest.fn();
  getRawOne = jest.fn();
  select = jest.fn().mockReturnThis();
  addSelect = jest.fn().mockReturnThis();
  groupBy = jest.fn().mockReturnThis();
  addGroupBy = jest.fn().mockReturnThis();
  having = jest.fn().mockReturnThis();
  andHaving = jest.fn().mockReturnThis();
  orHaving = jest.fn().mockReturnThis();
}

// Mock EntityManager
export class EntityManager {
  find = jest.fn();
  findOne = jest.fn();
  save = jest.fn();
  create = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  remove = jest.fn();
  count = jest.fn();
  findAndCount = jest.fn();
  createQueryBuilder = jest.fn(() => new SelectQueryBuilder());
  transaction = jest.fn((fn: any) => fn(this));
  getRepository = jest.fn();
}

// Mock DataSource
export class DataSource {
  constructor(options: any) {}
  initialize = jest.fn().mockResolvedValue(this);
  destroy = jest.fn().mockResolvedValue(void 0);
  synchronize = jest.fn().mockResolvedValue(void 0);
  runMigrations = jest.fn().mockResolvedValue([]);
  undoLastMigration = jest.fn().mockResolvedValue(void 0);
  getRepository = jest.fn();
  manager = new EntityManager();
  isInitialized = true;
}

// Mock @nestjs/typeorm decorators
export const InjectRepository = jest.fn(() => (target: any, key: string, index?: number) => {});
export const InjectDataSource = jest.fn(() => (target: any, key: string, index?: number) => {});
export const InjectEntityManager = jest.fn(() => (target: any, key: string, index?: number) => {});

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

// Export commonly used types
export interface FindManyOptions<T = any> {
  where?: any;
  relations?: string[];
  order?: any;
  skip?: number;
  take?: number;
}

export interface FindOneOptions<T = any> {
  where?: any;
  relations?: string[];
}

export enum IsolationLevel {
  SERIALIZABLE = 'SERIALIZABLE',
  REPEATABLE_READ = 'REPEATABLE READ',
  READ_COMMITTED = 'READ COMMITTED',
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
}
