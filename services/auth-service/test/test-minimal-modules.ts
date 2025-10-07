// Minimal test to isolate which module causes WeakMap error
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5433';
process.env.DB_USERNAME = 'test_user';
process.env.DB_PASSWORD = 'test_pass';
process.env.DB_NAME = 'soc_auth_test';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6380';
process.env.REDIS_PASSWORD = 'test_redis_pass';
process.env.JWT_SECRET = 'test-jwt-secret-key';

import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

async function testMinimalModules() {
  console.log('Testing minimal module combinations...\n');

  // Test 1: Just ConfigModule
  try {
    console.log('Test 1: ConfigModule only');
    @Module({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
    })
    class Test1Module {}

    const module1 = await Test.createTestingModule({
      imports: [Test1Module],
    }).compile();

    console.log('✅ ConfigModule works alone');
    await module1.close();
  } catch (error) {
    console.error('❌ ConfigModule failed:', error.message);
  }

  // Test 2: ConfigModule + TypeORM (no entities)
  try {
    console.log('\nTest 2: ConfigModule + TypeORM (no entities)');
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: '127.0.0.1',
          port: 5433,
          username: 'test_user',
          password: 'test_pass',
          database: 'soc_auth_test',
          entities: [],
          synchronize: true,
          logging: false,
        }),
      ],
    })
    class Test2Module {}

    const module2 = await Test.createTestingModule({
      imports: [Test2Module],
    }).compile();

    console.log('✅ TypeORM works without entities');
    await module2.close();
  } catch (error) {
    console.error('❌ TypeORM failed:', error.message);
  }

  // Test 3: Add entities one by one
  console.log('\nTest 3: Adding entities one by one...');

  const entityPaths = [
    { name: 'User', path: './src/modules/users/entities/user.entity' },
    { name: 'Organization', path: './src/modules/users/entities/organization.entity' },
    { name: 'Role', path: './src/modules/users/entities/role.entity' },
    { name: 'RefreshToken', path: './src/entities/refresh-token.entity' },
  ];

  const loadedEntities = [];

  for (const { name, path } of entityPaths) {
    try {
      console.log(`  Loading ${name}...`);
      const entityModule = await import(path);
      const entity = entityModule[name];

      if (!entity) {
        console.error(`    ❌ ${name} not found in ${path}`);
        continue;
      }

      loadedEntities.push(entity);

      // Test TypeORM with this entity
      @Module({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: '127.0.0.1',
            port: 5433,
            username: 'test_user',
            password: 'test_pass',
            database: 'soc_auth_test',
            entities: [...loadedEntities],
            synchronize: true,
            logging: false,
          }),
        ],
      })
      class TestEntityModule {}

      const moduleWithEntity = await Test.createTestingModule({
        imports: [TestEntityModule],
      }).compile();

      console.log(`    ✅ ${name} loaded successfully (total: ${loadedEntities.length} entities)`);
      await moduleWithEntity.close();
    } catch (error) {
      console.error(`    ❌ ${name} caused error:`, error.message);
      // Remove the problematic entity
      loadedEntities.pop();
    }
  }

  // Test 4: Add feature modules
  console.log('\nTest 4: Testing feature modules...');

  try {
    const { RedisModule } = await import('./src/modules/redis/redis.module');

    @Module({
      imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule],
    })
    class TestRedisModule {}

    const moduleWithRedis = await Test.createTestingModule({
      imports: [TestRedisModule],
    }).compile();

    console.log('✅ RedisModule works');
    await moduleWithRedis.close();
  } catch (error) {
    console.error('❌ RedisModule failed:', error.message);
  }
}

testMinimalModules().catch(console.error);
