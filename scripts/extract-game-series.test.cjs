const test=require('node:test');
const assert=require('node:assert/strict');
const {extract}=require('./extract-game-series.cjs');
test('extracts normalized span names without nested counters or duplicate apostrophe variants',()=>{
  const result=extract(`<span> Borderlands <span class="catalog-filter-count">8</span></span><span>A\n  Plague Tale </span><span>Asterix &amp; Obelix </span><span>Assassin’s Creed</span><span> Assassin's Creed </span><span>42</span>`);
  assert.deepEqual(result.names,['Borderlands','A Plague Tale','Asterix & Obelix','Assassin’s Creed']);
  assert.equal(result.duplicates,1);
});
test('rejects incomplete spans instead of silently importing incomplete names',()=>assert.throws(()=>extract('<span>Incomplete')));
