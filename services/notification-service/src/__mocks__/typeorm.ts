// TypeORM Mock for Jest compatibility
export const Entity = (options?: any) => (target: any) => target;
export const PrimaryGeneratedColumn = (options?: any) => (target: any, propertyName: string) => {};
export const Column = (options?: any) => (target: any, propertyName: string) => {};
export const CreateDateColumn = (options?: any) => (target: any, propertyName: string) => {};
export const UpdateDateColumn = (options?: any) => (target: any, propertyName: string) => {};
export const ManyToOne =
  (type?: any, inverseSide?: any, options?: any) => (target: any, propertyName: string) => {};
export const OneToMany =
  (type?: any, inverseSide?: any, options?: any) => (target: any, propertyName: string) => {};
export const JoinColumn = (options?: any) => (target: any, propertyName: string) => {};
export const Index = (options?: any) => (target: any, propertyName?: string) => {};
export const Unique = (options?: any) => (target: any, propertyName?: string) => {};
export const BeforeInsert = () => (target: any, propertyName: string) => {};
export const BeforeUpdate = () => (target: any, propertyName: string) => {};
export const AfterLoad = () => (target: any, propertyName: string) => {};

// Query operators
export const MoreThan = (value: any) => ({ _type: 'moreThan', _value: value });
export const LessThan = (value: any) => ({ _type: 'lessThan', _value: value });
export const MoreThanOrEqual = (value: any) => ({ _type: 'moreThanOrEqual', _value: value });
export const LessThanOrEqual = (value: any) => ({ _type: 'lessThanOrEqual', _value: value });
export const Equal = (value: any) => ({ _type: 'equal', _value: value });
export const Not = (value: any) => ({ _type: 'not', _value: value });
export const In = (value: any[]) => ({ _type: 'in', _value: value });
export const IsNull = () => ({ _type: 'isNull' });
export const Between = (from: any, to: any) => ({ _type: 'between', _value: [from, to] });
export const Like = (value: string) => ({ _type: 'like', _value: value });
export const ILike = (value: string) => ({ _type: 'iLike', _value: value });

// Mock Repository
export class Repository<T> {
  constructor(private entityClass?: any) {}

  find = jest.fn();
  findOne = jest.fn();
  findOneBy = jest.fn();
  findOneOrFail = jest.fn();
  save = jest.fn();
  create = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  remove = jest.fn();
  count = jest.fn();
  createQueryBuilder = jest.fn(() => new QueryBuilder());
  merge = jest.fn();
  preload = jest.fn();
  findAndCount = jest.fn();
  findByIds = jest.fn();
  increment = jest.fn();
  decrement = jest.fn();
  softDelete = jest.fn();
  restore = jest.fn();
}

// Mock QueryBuilder
export class QueryBuilder {
  select = jest.fn().mockReturnThis();
  addSelect = jest.fn().mockReturnThis();
  from = jest.fn().mockReturnThis();
  where = jest.fn().mockReturnThis();
  andWhere = jest.fn().mockReturnThis();
  orWhere = jest.fn().mockReturnThis();
  innerJoin = jest.fn().mockReturnThis();
  leftJoin = jest.fn().mockReturnThis();
  groupBy = jest.fn().mockReturnThis();
  orderBy = jest.fn().mockReturnThis();
  skip = jest.fn().mockReturnThis();
  take = jest.fn().mockReturnThis();
  getMany = jest.fn();
  getOne = jest.fn();
  getManyAndCount = jest.fn();
  getCount = jest.fn();
  getRawMany = jest.fn();
  getRawOne = jest.fn();
  setParameter = jest.fn().mockReturnThis();
  setParameters = jest.fn().mockReturnThis();
  limit = jest.fn().mockReturnThis();
  offset = jest.fn().mockReturnThis();
}

// Mock EntityManager
export class EntityManager {
  find = jest.fn();
  findOne = jest.fn();
  save = jest.fn();
  remove = jest.fn();
  create = jest.fn();
  transaction = jest.fn();
  getRepository = jest.fn();
}

// Mock QueryRunner
export class QueryRunner {
  connect = jest.fn().mockResolvedValue(undefined);
  startTransaction = jest.fn().mockResolvedValue(undefined);
  commitTransaction = jest.fn().mockResolvedValue(undefined);
  rollbackTransaction = jest.fn().mockResolvedValue(undefined);
  release = jest.fn().mockResolvedValue(undefined);
  manager = new EntityManager();
  query = jest.fn();
}

// Mock DataSource
export class DataSource {
  constructor(options?: any) {}
  initialize = jest.fn().mockResolvedValue(this);
  destroy = jest.fn();
  manager = new EntityManager();
  getRepository = jest.fn();
  createQueryRunner = jest.fn(() => new QueryRunner());
  query = jest.fn();
  isInitialized = true;
}

// Mock decorators for relations
export const ManyToMany =
  (type?: any, inverseSide?: any, options?: any) => (target: any, propertyName: string) => {};
export const OneToOne =
  (type?: any, inverseSide?: any, options?: any) => (target: any, propertyName: string) => {};
export const JoinTable = (options?: any) => (target: any, propertyName: string) => {};

// Mock transaction decorators
export const Transaction =
  (options?: any) => (target: any, propertyName: string, descriptor: any) =>
    descriptor;
export const TransactionManager =
  () => (target: any, propertyName: string, parameterIndex: number) => {};
export const TransactionRepository =
  (entity: any) => (target: any, propertyName: string, parameterIndex: number) => {};

// SelectQueryBuilder (alias for QueryBuilder)
export class SelectQueryBuilder<Entity> extends QueryBuilder {}

// BaseEntity mock
export class BaseEntity {
  static find = jest.fn();
  static findOne = jest.fn();
  static save = jest.fn();
  static remove = jest.fn();
  static delete = jest.fn();
  static count = jest.fn();
  static create = jest.fn();
  save = jest.fn();
  remove = jest.fn();
  reload = jest.fn();
}
