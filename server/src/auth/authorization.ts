import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@retrokeep/shared';
import { forbidden, unauthorized } from '../errors.js';
import type { SessionUser } from './session.js';

export const MODERATION_ROLES: readonly UserRole[] = ['moderator', 'admin'];

export function hasRole(
  user: SessionUser | null,
  roles: readonly UserRole[],
): boolean {
  return Boolean(user && roles.includes(user.role));
}

export function requireRoles(
  request: FastifyRequest,
  roles: readonly UserRole[] = MODERATION_ROLES,
): SessionUser {
  const user = request.user;

  if (!user) throw unauthorized();
  if (!roles.includes(user.role)) {
    throw forbidden('Недостаточно прав для этого действия.');
  }

  return user;
}
