import { join } from 'path';
import { DataSource } from 'typeorm';

export const TestDataSource = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 5433,
  username: 'test_user',
  password: 'test_pass',
  database: 'soc_clients_test',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
});
