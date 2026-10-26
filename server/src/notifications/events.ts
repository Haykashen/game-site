import type { Prisma, PrismaClient } from '@prisma/client';
import { fromMinorUnits } from '@discvault/shared';

type Db = PrismaClient | Prisma.TransactionClient;

interface EntryNotificationTarget {
  id: string;
  title: string;
  gameId: string;
  authorId: string;
  version: number;
}

interface NotificationRow extends Prisma.NotificationCreateManyInput {}

function formatMoney(minor: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(fromMinorUnits(minor))} ₽`;
}

async function entryFollowerIds(
  db: Db,
  entryId: string,
  excludedUserIds: readonly string[],
): Promise<string[]> {
  const excluded = new Set(excludedUserIds);
  const subscriptions = await db.marketEntrySubscription.findMany({
    where: { marketEntryId: entryId },
    select: { userId: true },
  });

  return subscriptions
    .map((subscription) => subscription.userId)
    .filter((userId) => !excluded.has(userId));
}

async function createNotifications(
  db: Db,
  rows: readonly NotificationRow[],
): Promise<void> {
  if (rows.length === 0) return;

  const uniqueRows: NotificationRow[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    if (row.dedupeKey) {
      if (seenKeys.has(row.dedupeKey)) continue;
      seenKeys.add(row.dedupeKey);
    }

    uniqueRows.push(row);
  }

  await db.notification.createMany({
    data: uniqueRows,
    skipDuplicates: true,
  });
}

/** Notifies users following a game when a new lot or listing appears. */
export async function notifyNewEntry(
  db: Db,
  entry: EntryNotificationTarget & {
    kind: 'listing' | 'auction';
    gameTitle: string;
  },
): Promise<void> {
  const subscriptions = await db.gameSubscription.findMany({
    where: {
      gameId: entry.gameId,
      ...(entry.kind === 'auction'
        ? { notifyAuctions: true }
        : { notifyListings: true }),
    },
    select: { userId: true },
  });

  const isAuction = entry.kind === 'auction';
  const rows: NotificationRow[] = subscriptions
    .filter((subscription) => subscription.userId !== entry.authorId)
    .map((subscription) => ({
      userId: subscription.userId,
      type: 'entry_created',
      title: isAuction ? 'Новый аукцион по вашей игре' : 'Новое объявление по вашей игре',
      message: isAuction
        ? `По игре «${entry.gameTitle}» появился новый аукцион: «${entry.title}».`
        : `По игре «${entry.gameTitle}» появилось новое объявление: «${entry.title}».`,
      marketEntryId: entry.id,
      gameId: entry.gameId,
      dedupeKey: `entry-created:${entry.id}:${subscription.userId}`,
    }));

  await createNotifications(db, rows);
}

/** Tells the author whether a new lot passed pre-publication review. */
export async function notifyEntryModerated(
  db: Db,
  params: {
    entry: EntryNotificationTarget;
    status: 'visible' | 'hidden' | 'removed';
    note: string | null;
  },
): Promise<void> {
  const approved = params.status === 'visible';
  const removed = params.status === 'removed';
  const reason = params.note ? ` Причина: ${params.note}` : '';

  await createNotifications(db, [
    {
      userId: params.entry.authorId,
      type: approved ? 'entry_approved' : 'entry_rejected',
      title: approved
        ? 'Лот прошёл проверку'
        : removed
          ? 'Лот снят с публикации'
          : 'Лот не прошёл проверку',
      message: approved
        ? `Лот «${params.entry.title}» одобрен и опубликован на маркете.`
        : removed
          ? `Лот «${params.entry.title}» снят с публикации.${reason}`
          : `Лот «${params.entry.title}» не опубликован.${reason}`,
      marketEntryId: params.entry.id,
      gameId: params.entry.gameId,
      dedupeKey: `entry-moderation:${params.entry.id}:${params.entry.version}:${params.status}`,
    },
  ]);
}

/** Notifies the seller, the previous leader and everyone following the lot. */
export async function notifyNewBid(
  db: Db,
  params: {
    entryId: string;
    entryTitle: string;
    gameId: string;
    authorId: string;
    bidId: string;
    bidder: { id: string; displayName: string };
    amountMinor: number;
    previousBidderId: string | null;
  },
): Promise<void> {
  const followers = await entryFollowerIds(db, params.entryId, [
    params.authorId,
    params.bidder.id,
    ...(params.previousBidderId ? [params.previousBidderId] : []),
  ]);
  const amount = formatMoney(params.amountMinor);
  const rows: NotificationRow[] = [];

  if (params.authorId !== params.bidder.id) {
    rows.push({
      userId: params.authorId,
      type: 'bid_placed',
      title: 'Новая ставка на ваш лот',
      message: `${params.bidder.displayName} сделал ставку ${amount} на лот «${params.entryTitle}».`,
      marketEntryId: params.entryId,
      gameId: params.gameId,
      actorId: params.bidder.id,
      dedupeKey: `bid:${params.bidId}:${params.authorId}`,
    });
  }

  if (
    params.previousBidderId &&
    params.previousBidderId !== params.bidder.id &&
    params.previousBidderId !== params.authorId
  ) {
    rows.push({
      userId: params.previousBidderId,
      type: 'bid_outbid',
      title: 'Вашу ставку перебили',
      message: `Ваша ставка на лот «${params.entryTitle}» перебита. Новая ставка — ${amount}.`,
      marketEntryId: params.entryId,
      gameId: params.gameId,
      actorId: params.bidder.id,
      dedupeKey: `bid:${params.bidId}:${params.previousBidderId}`,
    });
  }

  for (const userId of followers) {
    rows.push({
      userId,
      type: 'bid_placed',
      title: 'Новая ставка в отслеживаемом лоте',
      message: `${params.bidder.displayName} поставил ${amount} на лот «${params.entryTitle}».`,
      marketEntryId: params.entryId,
      gameId: params.gameId,
      actorId: params.bidder.id,
      dedupeKey: `bid:${params.bidId}:${userId}`,
    });
  }

  await createNotifications(db, rows);
}

/** Creates the winner/seller/loser/watcher notifications when an auction closes. */
export async function notifyAuctionClosed(
  db: Db,
  entry: EntryNotificationTarget & {
    winnerId: string | null;
    winnerName: string | null;
    priceMinor: number;
  },
): Promise<void> {
  const bidders = await db.bid.findMany({
    where: { marketEntryId: entry.id },
    select: { bidderId: true },
    distinct: ['bidderId'],
  });
  const bidderIds = bidders.map((bid) => bid.bidderId);
  const followers = await entryFollowerIds(db, entry.id, [
    entry.authorId,
    ...bidderIds,
  ]);
  const amount = formatMoney(entry.priceMinor);
  const winnerLabel = entry.winnerName ?? 'победитель';
  const rows: NotificationRow[] = [];
  const dedupeSuffix = `auction-closed:${entry.id}:${entry.version}`;

  if (entry.winnerId) {
    rows.push({
      userId: entry.winnerId,
      type: 'auction_won',
      title: 'Вы выиграли аукцион',
      message: `Лот «${entry.title}» достался вам за ${amount}. Свяжитесь с продавцом, чтобы обсудить сделку.`,
      marketEntryId: entry.id,
      gameId: entry.gameId,
      dedupeKey: `${dedupeSuffix}:${entry.winnerId}`,
    });

    rows.push({
      userId: entry.authorId,
      type: 'auction_sold',
      title: 'Ваш лот продан',
      message: `Аукцион «${entry.title}» завершён. Победитель — ${winnerLabel}, цена — ${amount}.`,
      marketEntryId: entry.id,
      gameId: entry.gameId,
      dedupeKey: `${dedupeSuffix}:${entry.authorId}`,
    });

    for (const bidderId of bidderIds) {
      if (bidderId === entry.winnerId) continue;

      rows.push({
        userId: bidderId,
        type: 'auction_lost',
        title: 'Аукцион завершён',
        message: `Вы не выиграли лот «${entry.title}». Победитель — ${winnerLabel}.`,
        marketEntryId: entry.id,
        gameId: entry.gameId,
        dedupeKey: `${dedupeSuffix}:${bidderId}`,
      });
    }
  } else {
    rows.push({
      userId: entry.authorId,
      type: 'auction_closed',
      title: 'Аукцион завершён без ставок',
      message: `Торги по лоту «${entry.title}» завершены без ставок.`,
      marketEntryId: entry.id,
      gameId: entry.gameId,
      dedupeKey: `${dedupeSuffix}:${entry.authorId}`,
    });
  }

  for (const userId of followers) {
    rows.push({
      userId,
      type: 'auction_closed',
      title: 'Аукцион завершён',
      message: entry.winnerId
        ? `Торги по лоту «${entry.title}» завершены. Победитель — ${winnerLabel}.`
        : `Торги по лоту «${entry.title}» завершены без ставок.`,
      marketEntryId: entry.id,
      gameId: entry.gameId,
      dedupeKey: `${dedupeSuffix}:${userId}`,
    });
  }

  await createNotifications(db, rows);
}

/** Notifies everyone following a lot when its owner closes or reopens it. */
export async function notifyEntryStatusChange(
  db: Db,
  params: {
    entry: EntryNotificationTarget;
    previousStatus: 'active' | 'sold' | 'closed';
    status: 'active' | 'sold' | 'closed';
    excludedUserIds?: readonly string[];
  },
): Promise<void> {
  if (params.previousStatus === params.status) return;

  const followers = await entryFollowerIds(db, params.entry.id, [
    params.entry.authorId,
    ...(params.excludedUserIds ?? []),
  ]);
  const isSold = params.status === 'sold';
  const isActive = params.status === 'active';
  const rows: NotificationRow[] = followers.map((userId) => ({
    userId,
    type: isSold ? 'entry_sold' : isActive ? 'entry_reopened' : 'entry_closed',
    title: isSold
      ? 'Объявление продано'
      : isActive
        ? 'Объявление снова активно'
        : 'Объявление снято',
    message: isSold
      ? `Лот «${params.entry.title}» больше не активен: объявление продано.`
      : isActive
        ? `Лот «${params.entry.title}» снова доступен для сделки.`
        : `Лот «${params.entry.title}» снят с продажи.`,
    marketEntryId: params.entry.id,
    gameId: params.entry.gameId,
    dedupeKey: `entry-status:${params.entry.id}:${params.status}:${params.entry.version}:${userId}`,
  }));

  await createNotifications(db, rows);
}

/** Notifies watchers when the asking price of a lot changes. */
export async function notifyEntryPriceChanged(
  db: Db,
  params: {
    entry: EntryNotificationTarget;
    previousPriceMinor: number;
    priceMinor: number;
  },
): Promise<void> {
  if (params.previousPriceMinor === params.priceMinor) return;

  const followers = await entryFollowerIds(db, params.entry.id, [
    params.entry.authorId,
  ]);
  const rows: NotificationRow[] = followers.map((userId) => ({
    userId,
    type: 'entry_price_changed',
    title: 'Изменилась цена лота',
    message: `Цена лота «${params.entry.title}» изменилась: ${formatMoney(params.previousPriceMinor)} → ${formatMoney(params.priceMinor)}.`,
    marketEntryId: params.entry.id,
    gameId: params.entry.gameId,
    dedupeKey: `entry-price:${params.entry.id}:${params.entry.version}:${userId}`,
  }));

  await createNotifications(db, rows);
}

/** Notifies the other party after a fixed-price deal is created. */
export async function notifyDealCreated(
  db: Db,
  params: {
    dealId: string;
    entry: { id: string; title: string; gameId: string };
    actor: { id: string; displayName: string };
    counterpartyId: string;
    amountMinor: number;
  },
): Promise<void> {
  if (params.counterpartyId === params.actor.id) return;

  await createNotifications(db, [
    {
      userId: params.counterpartyId,
      type: 'deal_created',
      title: 'Новая сделка по лоту',
      message: `${params.actor.displayName} создал сделку по лоту «${params.entry.title}» на ${formatMoney(params.amountMinor)}.`,
      marketEntryId: params.entry.id,
      gameId: params.entry.gameId,
      actorId: params.actor.id,
      dedupeKey: `deal-created:${params.dealId}:${params.counterpartyId}`,
    },
  ]);
}
