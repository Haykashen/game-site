import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { promises as fs } from 'node:fs';
import { env } from './env.js';
import { AppError, unauthorized } from './errors.js';
import { isPrismaError } from './lib/prismaErrors.js';
import { ensureStorageReady } from './lib/storage.js';
import { prisma } from './prisma.js';
import { resolveSession } from './auth/session.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerBidRoutes } from './bids/routes.js';
import { registerCatalogRoutes } from './catalog/routes.js';
import { registerCollectionRoutes } from './collection/routes.js';
import { registerDealRoutes } from './deals/routes.js';
import { registerMarketRoutes } from './market/routes.js';
import { registerNotificationRoutes } from './notifications/routes.js';
import { registerReportRoutes } from './reports/routes.js';
import { registerUploadRoutes } from './uploads/routes.js';
import { registerUserRoutes } from './users/routes.js';
import './types.js';

export async function buildApp() {
  const app = Fastify({
    logger: env.isProduction
      ? { level: 'info' }
      : {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        },
    bodyLimit: 12 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    limits: {
      fileSize: env.maxUploadBytes,
      files: 1,
      fields: 10,
    },
  });

  await fs.mkdir(env.uploadDir, { recursive: true });
  await app.register(staticPlugin, {
    root: env.uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
    cacheControl: true,
    maxAge: '7d',
  });

  app.decorate('prisma', prisma);
  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);

  app.decorate('optionalAuth', async (request, reply) => {
    await resolveSession(app.prisma, request, reply);
  });

  app.decorate('authenticate', async (request, reply) => {
    await resolveSession(app.prisma, request, reply);
    if (!request.user) throw unauthorized();
  });

  app.addHook('onReady', async () => {
    await ensureStorageReady();
  });

  app.addHook('onClose', async () => {
    await app.prisma.$disconnect();
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
    }

    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Некорректный запрос.',
          details: error.validation,
        },
      });
    }

    if (
      ['P1001', 'P1002', 'P1008', 'P1017', 'P2021'].some((code) =>
        isPrismaError(error, code),
      )
    ) {
      return reply.code(503).send({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'База данных временно недоступна. Попробуйте позже.',
        },
      });
    }

    if (isPrismaError(error, 'P2023')) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_ID',
          message: 'Некорректный идентификатор.',
        },
      });
    }

    if (isPrismaError(error, 'P2002')) {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Запись с такими данными уже существует.',
        },
      });
    }

    if (isPrismaError(error, 'P2003')) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Связанная запись не существует.',
        },
      });
    }

    if (isPrismaError(error, 'P2025')) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Запись не найдена.' },
      });
    }

    if (isPrismaError(error, 'P2034')) {
      return reply.code(409).send({
        error: {
          code: 'WRITE_CONFLICT',
          message: 'Данные изменились одновременно. Повторите запрос.',
        },
      });
    }

    const statusCode = error.statusCode;

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: {
          code: error.code ?? 'BAD_REQUEST',
          message: statusCode === 429 ? 'Слишком много запросов. Попробуйте позже.' : error.message,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');

    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера.',
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Маршрут ${request.method} ${request.url} не найден.`,
      },
    });
  });

  app.get('/', async () => ({
    service: 'retrokeep-api',
    version: '1.0.0',
    docs: '/api/health',
  }));

  const healthHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;

      return reply.send({
        status: 'ok',
        service: 'retrokeep-api',
        database: 'up',
        time: new Date().toISOString(),
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Health check failed');

      return reply.code(503).send({
        status: 'degraded',
        service: 'retrokeep-api',
        database: 'down',
        time: new Date().toISOString(),
      });
    }
  };

  app.get('/api/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerCatalogRoutes(app);
  registerCollectionRoutes(app);
  registerMarketRoutes(app);
  registerBidRoutes(app);
  registerDealRoutes(app);
  registerNotificationRoutes(app);
  registerReportRoutes(app);
  registerUploadRoutes(app);

  return app;
}
