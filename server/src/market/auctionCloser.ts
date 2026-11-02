import { marketStatus, moderationStatus, marketStatusWhere, statusWrite, statusWhere } from '../lib/statusSource.js';
import type { PrismaClient } from '@prisma/client';
import { notifyAuctionClosed } from '../notifications/events.js';

export async function closeAuctionById(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.marketEntry.findUnique({
      where: { id },
      include: { statusReference: { select: { code: true } },
        bids: {
          orderBy: [{ amountMinor: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          include: { bidder: { select: { statusReference: { select: { code: true } }, displayName: true } } },
        },
      },
    });

    if (
      !entry ||
      entry.kind !== 'auction' ||
      marketStatus(entry) !== 'active' ||
      moderationStatus(entry) !== 'visible' ||
      !entry.endsAt ||
      entry.endsAt.getTime() > Date.now()
    ) {
      return;
    }

    const topBid = entry.bids[0];
    const version = entry.version;

    if (!topBid) {
      const closed = await tx.marketEntry.updateMany({
        where: { id, ...marketStatusWhere({status: 'active'}), version },
        data: { ...await statusWrite(tx, 'MarketEntry', {status: 'closed'}, id), version: { increment: 1 } },
      });

      if (closed.count === 0) return;

      await notifyAuctionClosed(tx, {
        id: entry.id,
        title: entry.title,
        gameId: entry.gameId,
        authorId: entry.authorId,
        version: version + 1,
        winnerId: null,
        winnerName: null,
        priceMinor: entry.priceMinor,
      });
      return;
    }

    const updated = await tx.marketEntry.updateMany({
      where: { id, ...marketStatusWhere({status: 'active'}), version },
      data: {
        ...await statusWrite(tx, 'MarketEntry', {status: 'sold'}, id),
        winnerId: topBid.bidderId,
        currentPriceMinor: topBid.amountMinor,
        soldAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) return;

    await tx.deal.upsert({ include: {statusReference: {select: {code: true}}},
      where: { marketEntryId: id },
      create: {
        marketEntryId: id,
        buyerId: topBid.bidderId,
        sellerId: entry.authorId,
        amountMinor: topBid.amountMinor,
        ...await statusWrite(tx, 'Deal', {status: 'pending'}),
      },
      update: {},
    });

    await notifyAuctionClosed(tx, {
      id: entry.id,
      title: entry.title,
      gameId: entry.gameId,
      authorId: entry.authorId,
      version: version + 1,
      winnerId: topBid.bidderId,
      winnerName: topBid.bidder.displayName,
      priceMinor: topBid.amountMinor,
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
      ...marketStatusWhere({status: 'active',moderationStatus: 'visible'}),
      deletedAt: null,
      author: { ...statusWhere('active') },
      endsAt: { lte: new Date() },
      ...(onlyId ? { id: onlyId } : {}),
    },
    select: { statusReference: { select: { code: true } }, id: true },
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
