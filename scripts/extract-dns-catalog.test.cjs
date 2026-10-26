const test = require('node:test');
const assert = require('node:assert/strict');
const { extract, parseName } = require('./extract-dns-catalog.cjs');
const card = (id, title, body = '') => `<div class="catalog-product" data-product="${id}" data-code="001"><a class="catalog-product__name" title="${title}" href="/product/${id}/">WRONG visible title</a>${body}</div>`;
const editions = result => result.games.flatMap(g => g.platforms.flatMap(p => p.editions));

test('groups platforms and editions, retains product IDs, and reads title attribute', () => {
  const result = extract(card('a', 'Игра Example: Complete Edition (PS5)') + card('b', 'Игра Example (PS4)') + card('c', 'Игра Example Deluxe Edition (PS5)'), 'test.html');
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0].title, 'Example');
  assert.deepEqual(result.games[0].productIds, ['a', 'b', 'c']);
  assert.deepEqual(result.games[0].platforms.map(p => [p.name, p.editions.map(e => [e.id, e.name])]), [['PS5', [['a','Complete Edition'],['c','Deluxe Edition']]], ['PS4', [['b','Не указано']]]]);
});
test('extracts all picture URL variants, decodes entities, ignores images outside picture', () => {
  const result = extract(card('a', 'Игра Example (PS5)', `<img src="https://example.org/not-a-cover.png"><picture><source type="image/webp" srcset="https://example.org/fit/500/500/cover.webp?a=1&amp;b=2 1x, https://example.org/fit/1000/1000/cover.webp 2x"><img alt="WRONG alt" data-src="/cover.jpg" src="/cover.jpg"></picture>`), 'test.html');
  const entry = editions(result)[0];
  assert.equal(entry.images.length, 3);
  assert.equal(entry.image, 'https://example.org/fit/1000/1000/cover.webp');
  assert.ok(entry.images.includes('https://example.org/fit/500/500/cover.webp?a=1&b=2'));
  assert.ok(!entry.images.some(u => u.includes('not-a-cover')));
});
test('multi-platform product retains the same data-product ID in both platforms', () => {
  const result = extract(card('shared', 'Игра Example (PS4, PS5)'), 'test.html');
  assert.equal(result.stats.uniqueProducts, 1);
  assert.equal(result.stats.editionEntries, 2);
  assert.deepEqual(editions(result).map(e => e.id), ['shared','shared']);
});
test('handles quoted legacy titles, Russian aliases and chained editions', () => {
  assert.equal(parseName('Игра для PS4 "Призрак Цусимы" Special Edition (18+) [русская версия] (Экшен)').gameTitle, 'Ghost of Tsushima');
  const name = parseName('Игра Horizon Zero Dawn: Complete Edition - PlayStation Hits (PS4)');
  assert.equal(name.gameTitle, 'Horizon Zero Dawn');
  assert.deepEqual(name.editionTags, ['Complete Edition', 'PlayStation Hits']);
  assert.equal(parseName('Игра Final Fantasy VII Remake (PS4)').gameTitle, 'Final Fantasy VII Remake');
  assert.equal(parseName('Игра Mortal Kombat 11 Ultimate (PS5)').gameTitle, 'Mortal Kombat 11');
});
test('keeps RE4 original separate from Gold Edition of the remake', () => {
  const result = extract(card('original','Игра Resident Evil 4 (PS4)') + card('gold','Игра Resident Evil 4 Gold Edition (PS5)') + card('remake','Игра Resident Evil 4 Remake (PS5)'), 'test.html');
  assert.equal(result.games.length, 2);
  assert.deepEqual(result.games.find(g => g.title === 'Resident Evil 4 Remake').productIds, ['gold','remake']);
});
test('reads specification attributes, actual price and reviews without fabricating missing data', () => {
  const spec = (label, value) => `<div class="catalog-product__spec"><div class="catalog-product__spec-label">${label}:</div><div class="catalog-product__spec-value" title="${value}"></div></div>`;
  const result = extract(card('a', 'Игра Example (PS5)', spec('Дата выхода', '04.03.2022') + spec('Язык озвучки', 'английский, русский') + '<div class="product-buy__price">2 799&nbsp;₽</div><a class="catalog-product__rating"><b>4.9</b><span>|</span>294 отзыва</a>'), 'test.html');
  const entry = editions(result)[0];
  assert.equal(entry.releaseDate, '2022-03-04');
  assert.equal(entry.price, 2799);
  assert.equal(entry.reviewCount, 294);
  assert.deepEqual(entry.voiceLanguages, ['английский','русский']);
  assert.equal(entry.ageRating, null);
  assert.equal(entry.image, null);
});
