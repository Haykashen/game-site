import type { Prisma } from '@prisma/client';
import { badRequest, conflict, notFound } from '../errors.js';
import type { Row } from './routes.js';

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw badRequest(message);
}
function changed(old: Row, next: Row, fields: string[]): boolean {
  return fields.some((field) => JSON.stringify(old[field]) !== JSON.stringify(next[field]));
}

/** Domain checks supplement database foreign keys and the strict scalar schema. */
export async function validateRecord(tx: Prisma.TransactionClient, name: string, next: Row, old: Row | null): Promise<void> {
  if (name === 'Edition' && next.canonicalId) {
    const canonical = await tx.edition.findUnique({where: {id: String(next.canonicalId)}});
    requireRule(canonical && canonical.id !== next.id && !canonical.canonicalId && canonical.gameId === next.gameId, 'Основное издание должно относиться к той же игре и не быть вариантом другого издания.');
    if (old) requireRule(await tx.edition.count({where: {canonicalId: String(old.id)}}) === 0, 'У этого издания есть варианты. Сначала переназначьте их.');
  }
  if (name === 'Edition' && old && changed(old, next, ['gameId'])) {
    const used = await tx.copy.count({where: {editionId: String(old.id)}}) + await tx.marketEntry.count({where: {editionId: String(old.id)}}) + await tx.edition.count({where: {canonicalId: String(old.id)}});
    requireRule(!used, 'Нельзя менять игру у издания, используемого в коллекции, маркете или вариантах.');
  }
  if (name === 'MarketEntry') {
    const kind = next.kind;
    const itemType = next.itemType ?? 'game';
    if (next.editionId) {
      const edition = await tx.edition.findUnique({where: {id: String(next.editionId)}});
      requireRule(edition && edition.gameId === next.gameId && !edition.canonicalId, 'Выберите основное издание указанной игры.');
    }
    requireRule(itemType !== 'game' || (kind === 'listing' && next.listingType === 'purchase') || next.editionId, 'Для игры в продаже, обмене или аукционе обязательно издание.');
    if (kind === 'auction') {
      requireRule(!next.listingType, 'У аукциона не может быть типа объявления.');
      requireRule(Number(next.bidStepMinor) > 0 && next.endsAt, 'Для аукциона нужны положительный шаг ставки и дата окончания.');
      requireRule(!next.startsAt || new Date(String(next.endsAt)) > new Date(String(next.startsAt)), 'Окончание аукциона должно быть позже начала.');
    } else {
      requireRule(['sale', 'purchase', 'exchange'].includes(String(next.listingType)), 'Выберите тип объявления.');
      requireRule(!next.startsAt && !next.endsAt && !next.bidStepMinor, 'Даты торгов и шаг ставки доступны только аукционам.');
    }
    if (old) {
      const deal = await tx.deal.findUnique({where: {marketEntryId: String(old.id)}});
      if (deal && deal.status !== 'cancelled') {
        requireRule(next.status === 'sold' && !changed(old, next, ['authorId', 'gameId', 'editionId', 'kind', 'listingType', 'priceMinor']), 'Лот связан со сделкой: сначала отмените или удалите сделку.');
      }
      if (Number(old.bidCount) > 0) requireRule(!changed(old, next, ['authorId', 'gameId', 'editionId', 'kind', 'itemType', 'priceMinor', 'bidStepMinor', 'startsAt']), 'После ставок нельзя менять предмет, автора и условия торгов.');
      if (next.status === 'sold') requireRule(deal && deal.status !== 'cancelled', 'Продажа оформляется через таблицу сделок.');
    } else requireRule(!next.status || next.status !== 'sold', 'Сначала создайте лот, затем оформите сделку.');
  }
  if (name === 'Copy') {
    const edition = await tx.edition.findUnique({where: {id: String(next.editionId)}});
    requireRule(edition && !edition.canonicalId, 'Для экземпляра выберите основное издание.');
  }
  if (name === 'Bid') {
    for (const id of new Set([next.marketEntryId, old?.marketEntryId].filter(Boolean))) {
      const entry = await tx.marketEntry.findUnique({where: {id: String(id)}, include: {deal: true}});
      requireRule(entry && entry.kind === 'auction' && entry.status === 'active' && !entry.deal, 'Ставки можно корректировать только у активного аукциона без сделки.');
      if (id === next.marketEntryId) {
        requireRule(next.bidderId !== entry.authorId, 'Автор не может делать ставки на свой лот.');
        requireRule(Number(next.amountMinor) >= entry.priceMinor, 'Ставка не может быть ниже стартовой цены.');
      }
    }
  }
  if (name === 'Deal') {
    requireRule(next.buyerId !== next.sellerId, 'Покупатель и продавец должны различаться.');
    const entry = await tx.marketEntry.findUnique({where: {id: String(next.marketEntryId)}});
    if (!entry) throw notFound('Лот сделки не найден.');
    requireRule(next[entry.listingType === 'purchase' ? 'buyerId' : 'sellerId'] === entry.authorId, 'Автор лота должен быть соответствующей стороной сделки.');
    if (entry.kind === 'auction') {
      const top = await tx.bid.findFirst({where: {marketEntryId: entry.id}, orderBy: [{amountMinor: 'desc'}, {createdAt: 'asc'}, {id: 'asc'}]});
      requireRule(top && top.bidderId === next.buyerId && top.amountMinor === next.amountMinor, 'Покупатель и сумма аукционной сделки должны соответствовать выигравшей ставке.');
    }
    if (old) {
      const reviews = await tx.review.count({where: {dealId: String(old.id)}});
      if (reviews) requireRule(next.status === 'completed' && !changed(old, next, ['buyerId', 'sellerId', 'marketEntryId']), 'Сначала удалите отзывы, прежде чем менять участников или отменять сделку.');
    }
  }
  if (name === 'Review') {
    const deal = await tx.deal.findUnique({where: {id: String(next.dealId)}});
    requireRule(deal && deal.status === 'completed', 'Отзыв должен относиться к завершённой сделке.');
    requireRule((next.authorId === deal.buyerId && next.targetId === deal.sellerId) || (next.authorId === deal.sellerId && next.targetId === deal.buyerId), 'Автор и получатель отзыва должны быть разными участниками сделки.');
  }
  if (name === 'DiscussionComment' && next.parentId) {
    let parentId: string | null = String(next.parentId);
    const seen = new Set<string>();
    while (parentId) {
      requireRule(!seen.has(parentId) && parentId !== next.id, 'Нельзя создавать циклическую цепочку комментариев.');
      seen.add(parentId);
      const parent: {discussionId: string; parentId: string | null} | null = await tx.discussionComment.findUnique({where: {id: parentId}, select: {discussionId: true, parentId: true}});
      requireRule(parent && parent.discussionId === next.discussionId, 'Родительский комментарий должен относиться к тому же обсуждению.');
      parentId = parent.parentId;
    }
  }
  if (name === 'DiscussionComment' && old && old.discussionId !== next.discussionId) {
    requireRule(await tx.discussionComment.count({where: {parentId: String(old.id)}}) === 0, 'Сначала перенесите ответы этого комментария.');
  }
  if (name === 'Report') {
    const targetType = next.targetType;
    requireRule(targetType === 'user' ? next.targetUserId === next.targetId && !next.marketEntryId : next.marketEntryId === next.targetId && !next.targetUserId, 'Объект жалобы и связанная запись должны совпадать.');
    if (next.action && next.action !== 'none') {
      requireRule(next.status === 'resolved', 'Действие модерации требует завершённой жалобы.');
      requireRule(next.action === 'hide_entry' ? targetType === 'market_entry' : targetType === 'user', 'Действие не подходит объекту жалобы.');
      if (next.action === 'suspend_user') {
        const target = await tx.user.findUnique({where: {id: String(next.targetUserId)}});
        requireRule(target && target.role !== 'admin', 'Нельзя блокировать администратора через жалобу.');
      }
    }
  }
}

export async function reconcileRecords(tx: Prisma.TransactionClient, name: string, old: Row | null, next: Row | null): Promise<void> {
  if (name === 'Review') {
    for (const targetId of new Set([old?.targetId, next?.targetId].filter(Boolean).map(String))) {
      const stats = await tx.review.aggregate({where: {targetId}, _sum: {rating: true}, _count: {_all: true}});
      await tx.user.update({where: {id: targetId}, data: {ratingSum: stats._sum.rating ?? 0, ratingCount: stats._count._all}});
    }
  }
  if (name === 'Bid') {
    for (const marketEntryId of new Set([old?.marketEntryId, next?.marketEntryId].filter(Boolean).map(String))) {
      const entry = await tx.marketEntry.findUniqueOrThrow({where: {id: marketEntryId}, include: {deal: true}});
      if (entry.status !== 'active' || entry.deal) throw conflict('AUCTION_CLOSED', 'Сначала отмените сделку и откройте аукцион для корректировки ставок.');
      const top = await tx.bid.findFirst({where: {marketEntryId}, orderBy: [{amountMinor: 'desc'}, {createdAt: 'asc'}, {id: 'asc'}]});
      const count = await tx.bid.count({where: {marketEntryId}});
      await tx.marketEntry.update({where: {id: marketEntryId}, data: {bidCount: count, currentPriceMinor: top?.amountMinor ?? null, version: {increment: 1}}});
    }
  }
  if (name === 'Deal') {
    const ids = new Set([old?.marketEntryId, next?.marketEntryId].filter(Boolean).map(String));
    for (const id of ids) {
      const entry = await tx.marketEntry.findUniqueOrThrow({where: {id}});
      const deal = await tx.deal.findUnique({where: {marketEntryId: id}});
      const sold = deal && deal.status !== 'cancelled';
      await tx.marketEntry.update({where: {id}, data: {
        status: sold ? 'sold' : entry.kind === 'auction' ? 'closed' : 'active',
        soldAt: sold ? entry.soldAt ?? new Date() : null,
        winnerId: sold && entry.kind === 'auction' ? deal.buyerId : null,
        version: {increment: 1},
      }});
    }
    if (next) await tx.deal.update({where: {id: String(next.id)}, data: {completedAt: next.status === 'completed' ? next.completedAt as Date ?? new Date() : null}});
  }
  if (name === 'Report' && next) {
    const active = ['pending', 'in_review'].includes(String(next.status));
    await tx.report.update({where: {id: String(next.id)}, data: {
      activeKey: active ? `${next.reporterId}:${next.targetType}:${next.targetId}` : null,
      resolvedAt: active ? null : next.resolvedAt as Date ?? new Date(),
    }});
    if (next.status === 'resolved' && (old?.action !== next.action || old?.status !== next.status)) {
      if (next.action === 'hide_entry') await tx.marketEntry.update({where: {id: String(next.marketEntryId)}, data: {moderationStatus: 'hidden', version: {increment: 1}}});
      if (next.action === 'suspend_user') {
        await tx.user.update({where: {id: String(next.targetUserId)}, data: {status: 'suspended', suspendedAt: new Date()}});
        await tx.session.deleteMany({where: {userId: String(next.targetUserId)}});
      }
    }
  }
}
