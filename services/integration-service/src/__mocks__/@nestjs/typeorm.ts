// @nestjs/typeorm Mock
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

export const InjectRepository = (entity: any) => {
  return (target: any, propertyName: string, parameterIndex?: number) => {};
};

export const InjectDataSource = (dataSource?: any) => {
  return (target: any, propertyName: string, parameterIndex?: number) => {};
};

export const InjectEntityManager = (dataSource?: any) => {
  return (target: any, propertyName: string, parameterIndex?: number) => {};
};

export const getRepositoryToken = (entity: any) => {
  return `${entity.name}Repository`;
};

export const getDataSourceToken = (dataSource?: any) => {
  return dataSource ? `${dataSource}DataSource` : 'DataSource';
};

export const getEntityManagerToken = (dataSource?: any) => {
  return dataSource ? `${dataSource}EntityManager` : 'EntityManager';
};
