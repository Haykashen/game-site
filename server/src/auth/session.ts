import type { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import type { UserRole, UserStatus } from '@retrokeep/shared';
import { env } from '../env.js';

export const SESSION_COOKIE = 'rk_session';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  role: UserRole;
  status: UserStatus;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  request: FastifyRequest,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000,
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: request.headers['user-agent']?.slice(0, 500) ?? null,
      ip: request.ip,
    },
  });

  return { token, expiresAt };
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
  });
}

export async function destroySession(
  prisma: PrismaClient,
  token: string,
): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function resolveSession(
  prisma: PrismaClient,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  request.user = null;
  request.sessionId = null;

  const token = request.cookies[SESSION_COOKIE];
  if (!token) return;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          isDemo: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (
    !session ||
    session.expiresAt.getTime() <= Date.now() ||
    session.user.status !== 'active'
  ) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    clearSessionCookie(reply);
    return;
  }

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (session.lastUsedAt.getTime() < oneHourAgo) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  request.user = session.user;
  request.sessionId = session.id;
}
