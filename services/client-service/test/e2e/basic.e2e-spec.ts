// MUST be before any imports - Critical for E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

describe('Basic E2E Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    console.log('Starting basic E2E test...');
    console.log('Environment variables:');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_NAME:', process.env.DB_NAME);
  });

  it('should log environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
