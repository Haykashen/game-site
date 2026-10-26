import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkImages, gameCoverImages } from '../src/lib/editions.ts';
import type { Game, Edition } from '../src/types.ts';
const game = {id:'game',coverImage:'game-cover'} as Game;
const a = {id:'a',coverImages:['edition-a-front','edition-a-back']} as Edition;
const b = {id:'b',coverImages:['edition-b']} as Edition;
test('selecting another edition switches the complete artwork set',()=>{
  assert.deepEqual(artworkImages(game,[a,b],a),['edition-a-front','edition-a-back']);
  assert.deepEqual(artworkImages(game,[a,b],b),['edition-b']);
});
test('an edition without artwork does not borrow a different edition cover',()=>{
  assert.deepEqual(artworkImages(game,[a],{id:'empty',coverImages:[]} as unknown as Edition),[]);
  assert.deepEqual(artworkImages(game,[a]),['game-cover']);
});

test('catalogue previews prefer Showgames scans and retain earlier cover URLs',()=>{
  const scan='https://showgames.ru/image/front.jpg';
  assert.deepEqual(gameCoverImages(game,[{...a,coverImages:[scan,'edition-a-back']}]),[scan,'game-cover','edition-a-back']);
});
