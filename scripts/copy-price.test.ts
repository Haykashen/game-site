import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMoneyInput, parseMoneyInput, formatMoneyInput } from '../src/lib/moneyInput.ts';
import { copyDetailsSchema } from '../shared/src/collection.ts';
import { serializeCopy } from '../server/src/lib/serializers.ts';
import { parseCopies } from '../src/lib/storage.ts';

test('purchase price accepts formatted clipboard values and retains kopecks', () => {
  assert.equal(cleanMoneyInput('4 990,50 ₽'), '4990,50');
  assert.equal(parseMoneyInput('4\u00a0990.50'), 4990.5);
  assert.equal(formatMoneyInput('4990.5').replace(/\s/g, ' '), '4 990,50');
  assert.equal(parseMoneyInput(''), null);
  assert.equal(parseMoneyInput('0'), 0);
  for (const invalid of ['-20', '12abc', '1,234', '1.2.3']) assert.equal(cleanMoneyInput(invalid), null);
  for (const valid of [0, 4990.5, 0.29, 10000000]) assert.equal(copyDetailsSchema.safeParse({purchasePrice: valid}).success, true);
  for (const invalid of [-1, 1.234, 10000000.01]) assert.equal(copyDetailsSchema.safeParse({purchasePrice: invalid}).success, false);
});

test('stored minor units round-trip through copy API and local parsing without rounding', () => {
  const copy = {id: 'copy', editionId: 'edition', condition: 'New', completeness: 'CIB', purchasePriceMinor: 499050, purchaseDate: null, notes: '', photos: [], createdAt: new Date('2026-11-07T00:00:00Z'), updatedAt: new Date('2026-11-07T00:00:00Z')} as unknown as Parameters<typeof serializeCopy>[0];
  const dto = serializeCopy(copy);
  assert.equal(dto.purchasePrice, 4990.5);
  assert.equal(parseCopies([dto])?.[0]?.purchasePrice, 4990.5);
});
