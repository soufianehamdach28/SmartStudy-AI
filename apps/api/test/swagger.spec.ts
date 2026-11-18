import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { ConfigModule } from '@nestjs/config';
import { HealthCheckService } from '@nestjs/terminus';
import { AuthController, MeController } from '../src/modules/auth/auth.controller.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { DocumentsController } from '../src/modules/documents/documents.controller.js';
import { DocumentsService } from '../src/modules/documents/documents.service.js';
import { SummaryService } from '../src/modules/ai/summary.service.js';
import { FlashcardsService } from '../src/modules/ai/flashcards.service.js';
import { QuizService } from '../src/modules/ai/quiz.service.js';
import { QuizzesController } from '../src/modules/ai/quizzes.controller.js';
import { ConversationsController } from '../src/modules/ai/chat/conversations.controller.js';
import { ConversationsService } from '../src/modules/ai/chat/conversations.service.js';
import { UsageController } from '../src/modules/usage/usage.controller.js';
import { UsageService } from '../src/modules/usage/usage.service.js';
import { HealthController } from '../src/modules/health/health.controller.js';
import { DatabaseHealthIndicator } from '../src/modules/health/database.health.js';

describe('OpenAPI / Swagger Specification (integration)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    // Compile testing module with all controllers and mock services
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_ACCESS_SECRET: 'test-secret-at-least-32-characters-long' })],
        }),
      ],
      controllers: [
        AuthController,
        MeController,
        DocumentsController,
        QuizzesController,
        ConversationsController,
        UsageController,
        HealthController,
      ],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: DocumentsService, useValue: {} },
        { provide: SummaryService, useValue: {} },
        { provide: FlashcardsService, useValue: {} },
        { provide: QuizService, useValue: {} },
        { provide: ConversationsService, useValue: {} },
        { provide: UsageService, useValue: {} },
        { provide: HealthCheckService, useValue: {} },
        { provide: DatabaseHealthIndicator, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('SmartStudy AI API')
      .setDescription(
        'SmartStudy AI REST API for document processing, AI summaries, flashcards, quizzes, and grounded chat with citations.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth')
      .addTag('Users')
      .addTag('Documents')
      .addTag('AI Summaries')
      .addTag('Flashcards')
      .addTag('Quizzes')
      .addTag('Chat & Conversations')
      .addTag('Usage & Quotas')
      .addTag('Health')
      .build();

    document = SwaggerModule.createDocument(app, config);
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates OpenAPI 3.0 specification with valid metadata', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('SmartStudy AI API');
    expect(document.info.version).toBe('1.0.0');
    expect(document.info.description).toContain('SmartStudy');
  });

  it('configures JWT Bearer authentication scheme in securitySchemes', () => {
    const securitySchemes = document.components?.securitySchemes as Record<string, any>;
    expect(securitySchemes).toBeDefined();
    expect(securitySchemes['JWT-auth']).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    });
  });

  it('contains expected tags for all major functional domains', () => {
    const tagNames = document.tags?.map((t) => t.name) ?? [];
    expect(tagNames).toContain('Auth');
    expect(tagNames).toContain('Users');
    expect(tagNames).toContain('Documents');
    expect(tagNames).toContain('Quizzes');
    expect(tagNames).toContain('Chat & Conversations');
    expect(tagNames).toContain('Usage & Quotas');
    expect(tagNames).toContain('Health');
  });

  it('documents all core business endpoints with their operations', () => {
    const paths = Object.keys(document.paths);

    // Auth
    expect(paths).toContain('/auth/register');
    expect(paths).toContain('/auth/login');
    expect(paths).toContain('/auth/refresh');
    expect(paths).toContain('/auth/logout');
    expect(paths).toContain('/me');

    // Documents & AI
    expect(paths).toContain('/documents');
    expect(paths).toContain('/documents/{id}');
    expect(paths).toContain('/documents/{id}/summarize');
    expect(paths).toContain('/documents/{id}/flashcards');
    expect(paths).toContain('/documents/{id}/quizzes');

    // Quizzes & Attempts
    expect(paths).toContain('/quizzes/{id}/attempts');

    // Conversations & Chat
    expect(paths).toContain('/conversations');
    expect(paths).toContain('/conversations/{id}');
    expect(paths).toContain('/conversations/{id}/messages');

    // Usage & Health
    expect(paths).toContain('/usage');
    expect(paths).toContain('/health');
    expect(paths).toContain('/health/live');
    expect(paths).toContain('/health/ready');
  });

  it('documents multipart upload for POST /documents', () => {
    const uploadPost = document.paths['/documents']?.post;
    expect(uploadPost).toBeDefined();
    expect(uploadPost?.summary).toBe('Upload a course document (PDF or TXT)');
    const content = (uploadPost?.requestBody as any)?.content;
    expect(content).toBeDefined();
    expect(content['multipart/form-data']).toBeDefined();
  });
});
