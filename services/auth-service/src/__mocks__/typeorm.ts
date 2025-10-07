// Manual mock for TypeORM to avoid import issues in tests
export const getRepository = jest.fn();
export const createConnection = jest.fn();
export const getConnection = jest.fn();

// Decorator mocks
export const Entity = () => (target: any) => target;
export const Column = () => (target: any, key: string) => {};
export const PrimaryGeneratedColumn = () => (target: any, key: string) => {};
export const ManyToOne = () => (target: any, key: string) => {};
export const OneToMany = () => (target: any, key: string) => {};
export const OneToOne = () => (target: any, key: string) => {};
export const JoinColumn = () => (target: any, key: string) => {};
export const CreateDateColumn = () => (target: any, key: string) => {};
export const UpdateDateColumn = () => (target: any, key: string) => {};
export const Index = () => (target: any, key?: string) => {};
export const Unique = () => (target: any, key?: string) => {};
export const BeforeInsert = () => (target: any, key: string) => {};
export const BeforeUpdate = () => (target: any, key: string) => {};
export const ManyToMany = () => (target: any, key: string) => {};
export const JoinTable = () => (target: any, key: string) => {};
export const Generated = () => (target: any, key: string) => {};
export const Check = () => (target: any, key: string) => {};
export const DeleteDateColumn = () => (target: any, key: string) => {};
export const VersionColumn = () => (target: any, key: string) => {};

// Query operators - these return objects that TypeORM understands
export const MoreThan = (value: any) => ({ _type: 'moreThan', _value: value });
export const LessThan = (value: any) => ({ _type: 'lessThan', _value: value });
export const Equal = (value: any) => ({ _type: 'equal', _value: value });
export const Not = (value: any) => ({ _type: 'not', _value: value });
export const Like = (value: any) => ({ _type: 'like', _value: value });
export const ILike = (value: any) => ({ _type: 'ilike', _value: value });
export const In = (value: any[]) => ({ _type: 'in', _value: value });
export const Between = (from: any, to: any) => ({ _type: 'between', _value: [from, to] });
export const IsNull = () => ({ _type: 'isNull' });
export const Raw = (sql: string) => ({ _type: 'raw', _value: sql });
export const MoreThanOrEqual = (value: any) => ({ _type: 'moreThanOrEqual', _value: value });
export const LessThanOrEqual = (value: any) => ({ _type: 'lessThanOrEqual', _value: value });
export const Any = (value: any[]) => ({ _type: 'any', _value: value });

// Repository class with common methods
export class Repository<T> {
  create = jest.fn();
  save = jest.fn();
  find = jest.fn();
  findOne = jest.fn();
  findOneBy = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  count = jest.fn();
  findAndCount = jest.fn();
  query = jest.fn();
  createQueryBuilder = jest.fn(() => new SelectQueryBuilder());
}

// EntityManager class
export class EntityManager {
  create = jest.fn();
  save = jest.fn();
  find = jest.fn();
  findOne = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  transaction = jest.fn();
  query = jest.fn();
  getRepository = jest.fn(() => new Repository());
}

// DataSource class
export class DataSource {
  initialize = jest.fn().mockResolvedValue(this);
  destroy = jest.fn().mockResolvedValue(undefined);
  isInitialized = true;
  manager = new EntityManager();
  getRepository = jest.fn(() => new Repository());
  createQueryRunner = jest.fn();
}

// SelectQueryBuilder class with chainable methods
export class SelectQueryBuilder<T> {
  select = jest.fn().mockReturnThis();
  addSelect = jest.fn().mockReturnThis();
  from = jest.fn().mockReturnThis();
  where = jest.fn().mockReturnThis();
  andWhere = jest.fn().mockReturnThis();
  orWhere = jest.fn().mockReturnThis();
  leftJoin = jest.fn().mockReturnThis();
  leftJoinAndSelect = jest.fn().mockReturnThis();
  innerJoin = jest.fn().mockReturnThis();
  innerJoinAndSelect = jest.fn().mockReturnThis();
  orderBy = jest.fn().mockReturnThis();
  addOrderBy = jest.fn().mockReturnThis();
  groupBy = jest.fn().mockReturnThis();
  addGroupBy = jest.fn().mockReturnThis();
  having = jest.fn().mockReturnThis();
  skip = jest.fn().mockReturnThis();
  take = jest.fn().mockReturnThis();
  limit = jest.fn().mockReturnThis();
  offset = jest.fn().mockReturnThis();
  getMany = jest.fn().mockResolvedValue([]);
  getOne = jest.fn().mockResolvedValue(null);
  getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  getCount = jest.fn().mockResolvedValue(0);
  getRawMany = jest.fn().mockResolvedValue([]);
  getRawOne = jest.fn().mockResolvedValue(null);
  execute = jest.fn().mockResolvedValue({ affected: 0 });
  update = jest.fn().mockReturnThis();
  set = jest.fn().mockReturnThis();
  delete = jest.fn().mockReturnThis();
  insert = jest.fn().mockReturnThis();
  values = jest.fn().mockReturnThis();
}

// QueryRunner class
export class QueryRunner {
  connect = jest.fn();
  release = jest.fn();
  startTransaction = jest.fn();
  commitTransaction = jest.fn();
  rollbackTransaction = jest.fn();
  query = jest.fn();
  manager = new EntityManager();
}
