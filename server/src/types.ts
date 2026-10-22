export {};

declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
    optionalAuth: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>;
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user: import('./auth/session.js').SessionUser | null;
    sessionId: string | null;
  }
}
