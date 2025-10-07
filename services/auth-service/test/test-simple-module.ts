// Test with the simplest possible module configuration
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
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

// Create a minimal test module
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
      autoLoadEntities: false,
      synchronize: true,
      logging: false,
    }),
  ],
})
class SimpleTestModule {}

async function testSimpleModule() {
  try {
    console.log('Testing simple module...');
    const module = await Test.createTestingModule({
      imports: [SimpleTestModule],
    }).compile();

    console.log('✅ Simple module works!');
    await module.close();

    // Now test with entities
    console.log('\nTesting with entities...');
    const entities = await import('./src/entities');
    console.log('Loaded entities:', Object.keys(entities));

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
          entities: Object.values(entities),
          autoLoadEntities: false,
          synchronize: true,
          logging: false,
        }),
      ],
    })
    class TestModuleWithEntities {}

    const module2 = await Test.createTestingModule({
      imports: [TestModuleWithEntities],
    }).compile();

    console.log('✅ Module with entities works!');
    await module2.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testSimpleModule().catch(console.error);
