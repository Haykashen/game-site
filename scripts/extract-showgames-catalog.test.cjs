const test=require('node:test'),assert=require('node:assert/strict');
const {parseTitle,extract}=require('./extract-showgames-catalog.cjs');
test('localisation and edition names stay separate from game identity',()=>{
  const witcher=parseTitle('Ведьмак 3: Дикая охота (Witcher 3 Wild Hunt) Complete Edition (PS5, русская версия)','PS5');
  assert.equal(witcher.gameTitle,'The Witcher 3: Wild Hunt');
  assert.equal(witcher.editionName,'Complete Edition');
  assert.deepEqual(witcher.interfaceLanguages,['русский']);
  assert.equal(parseTitle('Nioh 3 Steelbook Launch Edition (PS5, русские субтитры)','PS5').gameTitle,'Nioh 3');
  assert.equal(parseTitle('Resident Evil 2 Remake (PS5, английская версия)','PS5').gameTitle,'Resident Evil 2');
  assert.equal(parseTitle('Dead Space (PS3, английская версия)','PS3').gameTitle,'Dead Space');
});
test('extracts only pic-1 with filename platform, source IDs and metadata',()=>{
  const d=extract(`<div class="product-thumb"><div class="image"><a href="https://showgames.ru/game"><img class="pic-1" title="Example Deluxe Edition (PS4, английская версия) (EU)" src="https://showgames.ru/image/front.jpg"><img class="pic-2" src="https://showgames.ru/image/back.jpg"></a><button onclick="cart.add('42');"></button></div><div class="price">1999р.</div></div>`,'showgames-ps4.html');
  assert.deepEqual(d.warnings,[]);const p=d.games[0].platforms[0].editions[0];
  assert.equal(p.id,'showgames-42');assert.equal(p.sourceProductId,'42');
  assert.deepEqual(p.platforms,['PS4']);assert.equal(p.region,'EU');
  assert.deepEqual(p.images,['https://showgames.ru/image/front.jpg']);
});
