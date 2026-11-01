import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `e2e-test-${Date.now()}@example.com`,
    password: 'Password123!',
  };

  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
      ],
    });

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up all e2e test users and related records
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'e2e-test' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'e2e-test' } },
    });
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates a new account and returns 201 with auth payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('tokens');
      expect(res.body).toHaveProperty('user');
      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
      expect(res.body.tokens.tokenType).toBe('Bearer');
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.user.role).toBe('STUDENT');
      expect(res.body.user).not.toHaveProperty('passwordHash');

      refreshToken = res.body.tokens.refreshToken;
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('rejects passwords shorter than 8 characters with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'shortpass@example.com',
          password: 'short',
        })
        .expect(400);
    });

    it('rejects invalid email formats with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid credentials and returns 200 with tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);

      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());

      // Update the active refresh token for subsequent tests
      refreshToken = res.body.tokens.refreshToken;
    });

    it('rejects incorrect password with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword999!',
        })
        .expect(401);
    });

    it('rejects unknown email with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent-user@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates refresh token and returns new tokens with 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
      expect(res.body.tokens.refreshToken).not.toBe(refreshToken);
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());

      // Update active refresh token to the new one
      refreshToken = res.body.tokens.refreshToken;
    });

    it('rejects an already-used refresh token with 401 (reuse detection)', async () => {
      // Re-using the old already-rotated refresh token
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-or-fake-token' })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes refresh token and returns 204 No Content', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(204);

      // Attempting to refresh with the revoked token should now fail
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
