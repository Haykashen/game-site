import test from 'node:test';
import assert from 'node:assert/strict';
import { editionWriteData } from '../src/lib/editionEditor.ts';
import { getTable } from '../server/src/admin/metadata.ts';
const fields=getTable('Edition').fields;
test('empty edition rows do not enter game save payload',()=>{
 assert.equal(editionWriteData({},fields,1),null);
 assert.equal(editionWriteData({name:'',platform:'',contents:[]},fields,2),null);
});
test('partial edition rows report row number and missing required fields',()=>{
 assert.throws(()=>editionWriteData({name:'Standard'},fields,3),/строка 3.*Платформа/);
 assert.throws(()=>editionWriteData({platform:'PS2'},fields,1),/Название/);
});
test('edition payload keeps selected reference keys without UI or readonly metadata',()=>{
 const data=editionWriteData({id:'edition',name:'Standard',platform:'PS2',regionId:'region',updatedAt:'version',__reference_platform:'PlayStation 2',gameId:'game'},fields,1);
 assert.deepEqual(data,{name:'Standard',platform:'PS2',regionId:'region'});
});
