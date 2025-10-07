export const getRepositoryToken = (entity: any) => {
  return `${entity.name}Repository`;
};

export const TypeOrmModule = {
  forRoot: jest.fn(() => ({
    module: class MockTypeOrmRootModule {},
  })),
  forRootAsync: jest.fn(() => ({
    module: class MockTypeOrmRootModule {},
  })),
  forFeature: jest.fn(() => ({
    module: class MockTypeOrmFeatureModule {},
    providers: [],
    exports: [],
  })),
};

export const InjectRepository = (entity: any) => {
  return (target: any, key: string | symbol, index?: number) => {};
};

export const Repository = jest.fn();

export const EntityRepository = (entity: any) => {
  return (target: any) => {};
};

export const Entity = (name?: string) => {
  return (target: any) => {};
};

export const PrimaryGeneratedColumn = (type?: any, options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const Column = (typeOrOptions?: any, options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const CreateDateColumn = (options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const UpdateDateColumn = (options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const BeforeInsert = () => {
  return (target: any, propertyName: string) => {};
};

export const BeforeUpdate = () => {
  return (target: any, propertyName: string) => {};
};

export const AfterLoad = () => {
  return (target: any, propertyName: string) => {};
};

export const OneToMany = (typeFunction: any, inverseSide: any, options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const ManyToOne = (typeFunction: any, inverseSide?: any, options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const ManyToMany = (typeFunction: any, inverseSide?: any, options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const JoinColumn = (options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const JoinTable = (options?: any) => {
  return (target: any, propertyName: string) => {};
};

export const Index = (
  nameOrFieldsOrOptions?: any,
  maybeFieldsOrOptions?: any,
  maybeOptions?: any
) => {
  return (target: any, propertyName?: string) => {};
};

export const Unique = (nameOrFields?: any, maybeFields?: any) => {
  return (target: any, propertyName?: string) => {};
};
