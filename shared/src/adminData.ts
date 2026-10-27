/** Public metadata for the administrator's record editor. No credentials are exposed. */
export type AdminValue = string | number | boolean | null | string[];
export type AdminRecord = Record<string, AdminValue>;
export interface AdminField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'list' | 'password';
  required: boolean;
  nullable: boolean;
  generated: boolean;
  readOnly: boolean;
  primary: boolean;
  options: string[];
  reference: string | null;
  multiline: boolean;
  dateOnly: boolean;
}
export interface AdminTable {
  name: string;
  label: string;
  fields: AdminField[];
  primaryKey: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
export interface AdminDataQuery {
  relatedUserId?: string;
  search?: string;
  filters?: Record<string, string>;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
export interface AdminReference { value: string; label: string }
const OPTION_LABELS: Record<string, string> = {
  user: 'Пользователь', moderator: 'Модератор', admin: 'Администратор', active: 'Активен', suspended: 'Заблокирован', deleted: 'Удалён',
  listing: 'Объявление', auction: 'Аукцион', game: 'Игра', cover: 'Обложка', manual: 'Мануал', map: 'Карта', soundtrack: 'Саундтрек', figure: 'Фигурка', steelbook: 'Стилбук', other: 'Другое',
  sale: 'Продажа', purchase: 'Покупка', exchange: 'Обмен', sold: 'Продано', closed: 'Закрыто', russian_post: 'Почта России', cdek: 'СДЭК', yandex: 'Яндекс',
  pending: 'Ожидает', completed: 'Завершена', cancelled: 'Отменена', visible: 'Опубликовано', hidden: 'Скрыто', removed: 'Удалено',
  market_entry: 'Объявление', fraud: 'Мошенничество', prohibited: 'Запрещённое', offensive: 'Оскорбления', spam: 'Спам', wrong_category: 'Неверная категория',
  in_review: 'На рассмотрении', resolved: 'Решена', dismissed: 'Отклонена', none: 'Нет', hide_entry: 'Скрыть объявление', suspend_user: 'Заблокировать пользователя',
  bid_placed: 'Новая ставка', bid_outbid: 'Ставка перебита', auction_won: 'Аукцион выигран', auction_lost: 'Аукцион проигран', auction_sold: 'Лот продан', auction_closed: 'Аукцион закрыт',
  entry_created: 'Новый лот', entry_sold: 'Лот продан', entry_closed: 'Лот закрыт', entry_reopened: 'Лот открыт', entry_price_changed: 'Цена изменена', entry_approved: 'Лот одобрен', entry_rejected: 'Лот отклонён', deal_created: 'Новая сделка',
  release: 'Релиз', guide: 'Руководство', community: 'Сообщество', update: 'Обновление', true: 'Да', false: 'Нет',
};
export const adminOptionLabel = (value: string): string => OPTION_LABELS[value] ?? value;
export function adminRecordKey(table: AdminTable, record: AdminRecord): string {
  return JSON.stringify(Object.fromEntries(table.primaryKey.map((key) => [key, record[key]])));
}
