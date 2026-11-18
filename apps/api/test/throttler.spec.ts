import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Controller,
  Get,
  HttpStatus,
  type INestApplication,
  Req,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  ThrottlerModule,
  SkipThrottle,
  Throttle,
  seconds,
} from '@nestjs/throttler';
import request from 'supertest';
import { AppThrottlerGuard } from '../src/core/common/guards/app-throttler.guard.js';
import { GlobalExceptionFilter } from '../src/core/common/filters/global-exception.filter.js';
import { apiErrorSchema } from '@smartstudy/shared';

const TEST_JWT_SECRET = 'a-super-secret-jwt-key-with-at-least-32-chars!';

@Controller('test-throttling')
class TestThrottlerController {
  @Get('default')
  getDefault() {
    return { ok: true };
  }

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get('strict')
  getStrict() {
    return { ok: true };
  }

  @SkipThrottle()
  @Get('unlimited')
  getUnlimited() {
    return { ok: true };
  }

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get('user-tracked')
  getUserTracked(@Req() req: any) {
    return { ok: true, ip: req.ip };
  }
}

describe('Rate Limiting & AppThrottlerGuard (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              JWT_ACCESS_SECRET: TEST_JWT_SECRET,
              RATE_LIMIT_TTL_SECONDS: 60,
              RATE_LIMIT_MAX: 10,
            }),
          ],
        }),
        JwtModule.register({
          global: true,
          secret: TEST_JWT_SECRET,
        }),
        ThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            errorMessage:
              'Too many requests. Please slow down and try again later.',
            throttlers: [
              {
                name: 'default',
                ttl: seconds(config.get<number>('RATE_LIMIT_TTL_SECONDS') ?? 60),
                limit: config.get<number>('RATE_LIMIT_MAX') ?? 10,
              },
            ],
          }),
        }),
      ],
      controllers: [TestThrottlerController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
        {
          provide: APP_GUARD,
          useClass: AppThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Endpoint rate limits and standardized error responses', () => {
    it('allows requests within the limit and blocks exceeding requests with RATE_LIMITED error', async () => {
      const server = app.getHttpServer();

      // Request 1: Allowed
      const res1 = await request(server).get('/test-throttling/strict');
      expect(res1.status).toBe(HttpStatus.OK);
      expect(res1.body).toEqual({ ok: true });

      // Request 2: Allowed (limit is 2)
      const res2 = await request(server).get('/test-throttling/strict');
      expect(res2.status).toBe(HttpStatus.OK);
      expect(res2.body).toEqual({ ok: true });

      // Request 3: Blocked (exceeded limit 2)
      const res3 = await request(server).get('/test-throttling/strict');
      expect(res3.status).toBe(HttpStatus.TOO_MANY_REQUESTS);

      // Verify standardized error contract
      expect(res3.body).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again later.',
        },
      });
      expect(() => apiErrorSchema.parse(res3.body)).not.toThrow();

      // Verify retry-after or rate-limit headers
      expect(res3.headers['retry-after']).toBeDefined();
    });

    it('does not throttle endpoints decorated with @SkipThrottle', async () => {
      const server = app.getHttpServer();

      // Fire 15 consecutive requests to an unlimited endpoint
      for (let i = 0; i < 15; i++) {
        const res = await request(server).get('/test-throttling/unlimited');
        expect(res.status).toBe(HttpStatus.OK);
        expect(res.body).toEqual({ ok: true });
      }
    });
  });

  describe('Dual-tracking (per user vs per IP)', () => {
    it('isolates rate limits per user when valid Bearer tokens are provided', async () => {
      const server = app.getHttpServer();

      const user1Token = await jwtService.signAsync(
        { sub: 'user-alpha-111' },
        { secret: TEST_JWT_SECRET },
      );
      const user2Token = await jwtService.signAsync(
        { sub: 'user-beta-222' },
        { secret: TEST_JWT_SECRET },
      );

      // User 1 uses their 2 allowed requests
      const resU1A = await request(server)
        .get('/test-throttling/user-tracked')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(resU1A.status).toBe(HttpStatus.OK);

      const resU1B = await request(server)
        .get('/test-throttling/user-tracked')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(resU1B.status).toBe(HttpStatus.OK);

      // User 1 is now rate limited
      const resU1C = await request(server)
        .get('/test-throttling/user-tracked')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(resU1C.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(resU1C.body.error.code).toBe('RATE_LIMITED');

      // User 2 (same IP) should still be allowed because rate limit is per user
      const resU2A = await request(server)
        .get('/test-throttling/user-tracked')
        .set('Authorization', `Bearer ${user2Token}`);
      expect(resU2A.status).toBe(HttpStatus.OK);
      expect(resU2A.body.ok).toBe(true);
    });
  });
});
