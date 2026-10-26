import assert from 'node:assert/strict';
import test from 'node:test';
import { migrationState } from '../deploy/migration-state.mjs';

const applied = (name, checksum = 'checksum') => ({
  migration_name: name, checksum, finished_at: new Date(), rolled_back_at: null,
});

test('unchanged migration history permits an application-only update', () => {
  assert.deepEqual(migrationState(new Map([['001_init', 'checksum']]), [applied('001_init')]), []);
});
test('new migrations are reported instead of silently applied', () => {
  assert.deepEqual(migrationState(new Map([['001_init', 'checksum'], ['002_new', 'new']]), [applied('001_init')]), ['002_new']);
});
test('modified or missing applied migration blocks the release', () => {
  assert.throws(() => migrationState(new Map([['001_init', 'changed']]), [applied('001_init')]), /modified/);
  assert.throws(() => migrationState(new Map(), [applied('001_init')]), /missing/);
});
test('failed migration blocks the release; explicitly rolled back attempt can be retried', () => {
  const failed = { ...applied('001_init'), finished_at: null };
  assert.throws(() => migrationState(new Map([['001_init', 'checksum']]), [failed]), /Unfinished/);
  assert.deepEqual(migrationState(new Map([['001_init', 'checksum']]), [{ ...failed, rolled_back_at: new Date() }]), ['001_init']);
});
test('out-of-order migrations block the release', () => {
  assert.throws(() => migrationState(new Map([['001_old', 'old'], ['002_applied', 'checksum']]), [applied('002_applied')]), /precedes/);
});
