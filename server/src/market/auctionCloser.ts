import type { PrismaClient } from '@prisma/client';

export async function closeAuctionById(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.marketEntry.findUnique({
      where: { id },
      include: {
        bids: {
          orderBy: [{ amountMinor: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
      },
    });

    if (
      !entry ||
      entry.kind !== 'auction' ||
      entry.status !== 'active' ||
      !entry.endsAt ||
      entry.endsAt.getTime() > Date.now()
    ) {
      return;
    }

    const topBid = entry.bids[0];
    const version = entry.version;

    if (!topBid) {
      await tx.marketEntry.updateMany({
        where: { id, status: 'active', version },
        data: { status: 'closed', version: { increment: 1 } },
      });
      return;
    }

    const updated = await tx.marketEntry.updateMany({
      where: { id, status: 'active', version },
      data: {
        status: 'sold',
        winnerId: topBid.bidderId,
        currentPriceMinor: topBid.amountMinor,
        soldAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) return;

    await tx.deal.upsert({
      where: { marketEntryId: id },
      create: {
        marketEntryId: id,
        buyerId: topBid.bidderId,
        sellerId: entry.authorId,
        amountMinor: topBid.amountMinor,
        status: 'pending',
      },
      update: {},
    });
  });
}

export async function closeExpiredAuctions(
  prisma: PrismaClient,
  onlyId?: string,
): Promise<number> {
  const expired = await prisma.marketEntry.findMany({
    where: {
      kind: 'auction',
      status: 'active',
      deletedAt: null,
      endsAt: { lte: new Date() },
      ...(onlyId ? { id: onlyId } : {}),
    },
    select: { id: true },
    take: 100,
  });

  for (const entry of expired) {
    try {
      await closeAuctionById(prisma, entry.id);
    } catch (error) {
      // One problematic lot must not prevent the remaining auctions from closing.
      console.error(`Auction closer failed for ${entry.id}:`, error);
    }
  }

  return expired.length;
}

export function startAuctionWorker(prisma: PrismaClient): () => void {
  let lastLoggedAt = 0;

  const timer = setInterval(() => {
    void closeExpiredAuctions(prisma).catch((error) => {
      const now = Date.now();
      // Avoid flooding the log while PostgreSQL is unavailable.
      if (now - lastLoggedAt > 5 * 60_000) {
        lastLoggedAt = now;
        console.error('Auction closer failed:', error);
      }
    });
  }, 30_000);

  timer.unref();
  return () => clearInterval(timer);
}
