import { badRequest } from '../errors.js';

export const MODERATED_MODELS = new Set(['Game', 'Edition', 'MarketEntry', 'Discussion', 'NewsPost']);

/** Review metadata is assigned by the server, never by the editor. */
export function applyModeration(model: string, data: Record<string, unknown>, old: Record<string, unknown> | null, reviewerId: string) {
  if (!MODERATED_MODELS.has(model)) return;
  const status = data.moderationStatus ?? old?.moderationStatus ?? 'draft';
  if (status === 'hidden' && !String(data.moderationNote ?? old?.moderationNote ?? '').trim()) throw badRequest('Укажите причину отклонения.');
  if (data.moderationStatus !== undefined && data.moderationStatus !== old?.moderationStatus) {
    data.moderatedAt = status === 'visible' || status === 'hidden' ? new Date() : null;
    data.moderatorId = status === 'visible' || status === 'hidden' ? reviewerId : null;
    if (status === 'draft' || status === 'pending') data.moderationNote = null;
  }
}
