import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

/**
 * Requires the local infrastructure to be running (`npm run infra:up`).
 * Run with: npm run test:e2e -w @smartstudy/api
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health/live (GET) reports the process as up', () => {
    return request(app.getHttpServer()).get('/health/live').expect(200);
  });

  it('/health/ready (GET) reports the database as up', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body.info.database.status).toBe('up');
      });
  });
});
