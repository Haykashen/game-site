import type { Copy, CopyUpdateDetails, Edition } from '../types';
import { cleanMoneyInput, parseMoneyInput } from './moneyInput';
import { updateCopySchema } from '@discvault/shared';
export interface CopyEditorValues {condition: string; completeness: string; region: string; purchasePrice: string; purchaseDate: string; notes: string; photos: string[]; quantity: number}
export function copyEditorValues(copy: Copy, edition: Edition, photos: readonly string[], quantity: number): CopyEditorValues {
  return {condition: copy.condition, completeness: copy.completeness, region: copy.region ?? edition.region, purchasePrice: copy.purchasePrice === null ? '' : String(copy.purchasePrice), purchaseDate: copy.purchaseDate, notes: copy.notes, photos: [...photos], quantity: Math.max(1, quantity)};
}
function normalized(values: CopyEditorValues) {
  return {...values, condition: values.condition.trim(), notes: values.notes.trim(), purchasePrice: cleanMoneyInput(values.purchasePrice) === null ? values.purchasePrice : parseMoneyInput(values.purchasePrice)};
}
export function copyEditorDirty(initial: CopyEditorValues, draft: CopyEditorValues): boolean {return JSON.stringify(normalized(initial)) !== JSON.stringify(normalized(draft));}
/** An unchanged inherited region remains inherited; only an explicit edit overrides it. */
export function copyEditorDetails(initial: CopyEditorValues, draft: CopyEditorValues): CopyUpdateDetails {
  if (cleanMoneyInput(draft.purchasePrice) === null) throw Error('Укажите корректную цену покупки.');
  const price = parseMoneyInput(draft.purchasePrice);
  if (price !== null && (price < 0 || price > 10000000)) throw Error('Укажите цену от 0 до 10 000 000 ₽ с точностью до копеек.');
  const details = {condition: draft.condition.trim() || 'Не указано', completeness: draft.completeness.trim() || 'Не указано', purchasePrice: parseMoneyInput(draft.purchasePrice), purchaseDate: draft.purchaseDate, notes: draft.notes.trim(), quantity: draft.quantity,
    ...(initial.region !== draft.region ? {region: draft.region} : {}),
    ...(JSON.stringify(initial.photos) !== JSON.stringify(draft.photos) || initial.quantity !== draft.quantity ? {photos: draft.photos} : {})};
  const parsed = updateCopySchema.safeParse(details);
  if (!parsed.success) throw Error(parsed.error.issues[0]?.message ?? 'Проверьте реквизиты экземпляра.');
  return details;
}
export function reorderPhoto(photos: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= photos.length || to < 0 || to >= photos.length || from === to) return [...photos];
  const next = [...photos]; next.splice(to, 0, next.splice(from, 1)[0]!); return next;
}
