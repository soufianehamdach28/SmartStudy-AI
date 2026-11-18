import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './core/config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<Env, true>);
  const corsOrigins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Business routes live under /api; health probes stay at /health.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });

  // Helmet with customized CSP to allow Swagger UI scripts and styles
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
        },
      },
    }),
  );

  app.enableCors({ origin: corsOrigins, credentials: true });
  app.enableShutdownHooks();

  // OpenAPI / Swagger documentation
  const swaggerConfig = new DocumentBuilder()
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
        description: 'Enter your JWT access token (e.g. from /api/auth/login)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication, registration, session refresh and logout')
    .addTag('Users', 'User profile management')
    .addTag(
      'Documents',
      'Document upload, ingestion, retrieval, and cascade deletion',
    )
    .addTag('AI Summaries', 'Document summary generation and caching')
    .addTag('Flashcards', 'AI flashcard generation and retrieval')
    .addTag('Quizzes', 'AI quiz generation, retrieval, and attempt scoring')
    .addTag(
      'Chat & Conversations',
      'Grounded conversational assistant with citations',
    )
    .addTag('Usage & Quotas', 'User consumption and AI request quota tracking')
    .addTag('Health', 'System liveness and readiness health checks')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'SmartStudy AI — API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
    },
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
