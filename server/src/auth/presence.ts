import type { Prisma, PrismaClient } from '@prisma/client';

export const PRESENCE_UPDATE_MS = 60_000;
export const ONLINE_WINDOW_MS = 120_000;

export function isUserOnline(status: string, lastSessionActivity: Date | null, now: Date): boolean {
  if (status !== 'active' || !lastSessionActivity) return false;
  const age = now.getTime() - lastSessionActivity.getTime();
  return age >= 0 && age <= ONLINE_WINDOW_MS;
}

export async function persistLastSeen(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
  // Prisma's @updatedAt belongs to profile edits, not background activity.
  await tx.$executeRaw`UPDATE "users" SET "last_seen_at" = ${now}
    WHERE "id" = ${userId}::uuid AND ("last_seen_at" IS NULL OR "last_seen_at" < ${now})`;
}

/** updateMany tolerates concurrent logout; lastSeenAt survives session deletion. */
export async function touchPresence(prisma: PrismaClient, sessionId: string, userId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const touched = await tx.session.updateMany({
      where: {id: sessionId, userId, expiresAt: {gt: now}, lastUsedAt: {lte: new Date(now.getTime() - PRESENCE_UPDATE_MS)}},
      data: {lastUsedAt: now},
    });
    if (touched.count) await persistLastSeen(tx, userId, now);
  });
}
