import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyRoutePath } from '../src/lib/routing.ts';
test('legacy hash links retain the route and query on clean URLs', () => {
 assert.equal(legacyRoutePath('#/games'), '/games');
 assert.equal(legacyRoutePath('#/community/showcase?post=abc'), '/community/showcase?post=abc');
 assert.equal(legacyRoutePath('#/collection/copy?edit=1'), '/collection/copy?edit=1');
 assert.equal(legacyRoutePath('#section'), null);
 assert.equal(legacyRoutePath('#//example.com'), null);
});
