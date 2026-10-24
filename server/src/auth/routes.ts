import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema, type AuthResponse } from '@discvault/shared';
import { conflict, forbidden, unauthorized } from '../errors.js';
import { getUserProfile } from '../lib/serializers.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import { parse } from '../lib/validation.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  SESSION_COOKIE,
  setSessionCookie,
} from './session.js';

const AUTH_RATE_LIMIT = {
  max: 15,
  timeWindow: '15 minutes',
} as const;

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/auth/register',
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const input = parse(registerSchema, request.body);

      const existing = await app.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existing) {
        throw conflict('EMAIL_TAKEN', 'Аккаунт с такой почтой уже существует.');
      }

      const passwordHash = await hashPassword(input.password);

      let user;

      try {
        user = await app.prisma.user.create({
          data: {
            email: input.email,
            passwordHash,
            displayName: input.displayName,
          },
        });
      } catch (error) {
        if (isPrismaError(error, 'P2002')) {
          throw conflict('EMAIL_TAKEN', 'Аккаунт с такой почтой уже существует.');
        }
        throw error;
      }

      const session = await createSession(app.prisma, user.id, request);
      setSessionCookie(reply, session.token, session.expiresAt);

      const body: AuthResponse = {
        user: await getUserProfile(app.prisma, user),
      };

      return reply.code(201).send(body);
    },
  );

  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const input = parse(loginSchema, request.body);

      const user = await app.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user || !user.passwordHash || user.isDemo) {
        throw unauthorized('Неверная почта или пароль.');
      }

      const isValid = await verifyPassword(user.passwordHash, input.password);

      if (!isValid) {
        throw unauthorized('Неверная почта или пароль.');
      }

      if (user.status !== 'active') {
        throw forbidden(
          'Аккаунт заблокирован. Обратитесь в поддержку, если считаете это ошибкой.',
        );
      }

      await app.prisma.session.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      });

      const session = await createSession(app.prisma, user.id, request);
      setSessionCookie(reply, session.token, session.expiresAt);

      const body: AuthResponse = {
        user: await getUserProfile(app.prisma, user),
      };

      return body;
    },
  );

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];

    if (token) {
      await destroySession(app.prisma, token);
    }

    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.post(
    '/api/v1/auth/logout-all',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;

      if (!user) throw unauthorized();

      await app.prisma.session.deleteMany({ where: { userId: user.id } });
      clearSessionCookie(reply);

      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/auth/me',
    { preHandler: app.authenticate },
    async (request): Promise<AuthResponse> => {
      const sessionUser = request.user;

      if (!sessionUser) throw unauthorized();

      const user = await app.prisma.user.findUnique({
        where: { id: sessionUser.id },
      });

      if (!user) throw unauthorized();

      return { user: await getUserProfile(app.prisma, user) };
    },
  );
}
