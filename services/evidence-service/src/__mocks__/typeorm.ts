// Mock for TypeORM
export class Repository {
  constructor() {}

  create = jest.fn();
  save = jest.fn();
  find = jest.fn();
  findOne = jest.fn();
  findAndCount = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  softDelete = jest.fn();
  remove = jest.fn();
  count = jest.fn();
  createQueryBuilder = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getRawOne: jest.fn(),
    getCount: jest.fn(),
    execute: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  }));
}

export class EntityRepository {
  constructor() {}
}

export class DataSource {
  constructor(options?: any) {}
  initialize = jest.fn().mockResolvedValue(this);
  destroy = jest.fn().mockResolvedValue(void 0);
  isInitialized = true;
  getRepository = jest.fn(() => new Repository());
  createQueryBuilder = jest.fn();
  manager = {
    transaction: jest.fn(fn =>
      fn({
        save: jest.fn(),
        remove: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
      })
    ),
  };
}

export const getRepositoryToken = (entity: any) => {
  return `${entity.name || entity}Repository`;
};

export const InjectRepository = (entity: any) => {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    // Mock implementation
  };
};

export const Entity = (name?: string) => {
  return (target: any) => {
    // Mock implementation
  };
};

export const PrimaryGeneratedColumn = (type?: string) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const Column = (typeOrOptions?: any, options?: any) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const CreateDateColumn = () => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const UpdateDateColumn = () => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const DeleteDateColumn = () => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const ManyToOne = (type?: any, inverseSide?: any, options?: any) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const OneToMany = (type?: any, inverseSide?: any, options?: any) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const ManyToMany = (type?: any, inverseSide?: any, options?: any) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const JoinTable = (options?: any) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const JoinColumn = (options?: any) => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const Index = (nameOrFields?: any, fields?: any, options?: any) => {
  return (target: any, propertyKey?: string) => {
    // Mock implementation
  };
};

export const BeforeInsert = () => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

export const BeforeUpdate = () => {
  return (target: any, propertyKey: string) => {
    // Mock implementation
  };
};

// TypeORM operators
export const In = (values: any[]) => ({ _type: 'in', _value: values });
export const Between = (from: any, to: any) => ({ _type: 'between', _value: [from, to] });
export const LessThanOrEqual = (value: any) => ({ _type: 'lessThanOrEqual', _value: value });
export const MoreThanOrEqual = (value: any) => ({ _type: 'moreThanOrEqual', _value: value });
export const ILike = (value: string) => ({ _type: 'ilike', _value: value });
export const Like = (value: string) => ({ _type: 'like', _value: value });
export const Not = (value: any) => ({ _type: 'not', _value: value });
export const IsNull = () => ({ _type: 'isNull' });
export const Raw = (sql: string) => ({ _type: 'raw', _value: sql });

// Additional exports that might be used
export class BaseEntity {
  save = jest.fn();
  remove = jest.fn();
  softRemove = jest.fn();
  reload = jest.fn();
  hasId = jest.fn();
}
