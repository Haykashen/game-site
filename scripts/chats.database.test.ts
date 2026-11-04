import { statusWrite } from '../server/src/lib/statusSource.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const allowed=(process.env.CI==='true'&&(process.env.DATABASE_URL??'').includes('/discvault_ci'))||
 (process.env.CHATS_LOCAL_TESTS==='true'&&(process.env.DATABASE_URL??'').includes('localhost:51218/'));
test('private chats: author contact, access control, history, retries and read state',{skip:!allowed},async()=>{
 process.env.S3_ENDPOINT='';process.env.S3_BUCKET='';
 const {buildApp}=await import('../server/src/app.js');const app=await buildApp();
 const suffix=randomUUID();const users:{id:string;cookie:string}[]=[];let gameId='chat-test-'+suffix;
 try{
  for(const name of ['Покупатель','Продавец','Посторонний']){
   const r=await app.inject({method:'POST',url:'/api/v1/auth/register',payload:{email:randomUUID()+'@test.local',password:'LocalTest123!',displayName:name}});
   assert.equal(r.statusCode,201,r.body);users.push({id:r.json().user.id,cookie:r.cookies.map(c=>c.name+'='+c.value).join('; ')});
  }
  const [a,b,c]=users as [typeof users[number],typeof users[number],typeof users[number]];
  const call=(who:typeof a,method:'GET'|'POST',url:string,payload?:unknown)=>app.inject({method,url,headers:{cookie:who.cookie},...(payload?{payload}: {})});
  await app.prisma.game.create({data:{id:gameId,title:gameId,publisher:'',description:''}});
  const entry=await app.prisma.marketEntry.create({data:{authorId:b.id,kind:'listing',listingType:'sale',gameId,title:'The Witcher 3 · Complete Edition',condition:'Отличное',priceMinor:250000,description:'Диск и коробка, без царапин.',deliveryServices:[],shipsFrom:'Москва',...await statusWrite(app.prisma,'MarketEntry',{kind:'listing',moderationStatus:'visible'})}});
  assert.equal((await app.inject({method:'GET',url:'/api/v1/chats'})).statusCode,401);
  const starts=await Promise.all([call(a,'POST','/api/v1/chats',{entryId:entry.id}),call(a,'POST','/api/v1/chats',{entryId:entry.id})]);
  const start=starts[0]!;assert.equal(start.statusCode,200,start.body);const id=start.json().id;assert.equal(starts[1]!.statusCode,200,starts[1]!.body);assert.equal(starts[1]!.json().id,id);
  assert.equal((await call(a,'POST','/api/v1/chats',{entryId:entry.id})).json().id,id);
  assert.equal((await call(b,'POST','/api/v1/chats',{entryId:entry.id})).statusCode,400);
  assert.equal((await call(c,'GET',`/api/v1/chats/${id}/messages`)).statusCode,404);
  assert.equal((await call(c,'POST',`/api/v1/chats/${id}/messages`,{text:'intrusion',clientId:randomUUID()})).statusCode,404);
  const payload={text:'Здравствуйте! Подскажите, диск без царапин?',clientId:randomUUID()};
  const sent=await call(a,'POST',`/api/v1/chats/${id}/messages`,payload);assert.equal(sent.statusCode,200,sent.body);
  assert.equal((await call(a,'POST',`/api/v1/chats/${id}/messages`,payload)).json().id,sent.json().id);
  assert.equal(await app.prisma.chatMessage.count({where:{chatId:id}}),1);
  assert.equal((await call(a,'POST',`/api/v1/chats/${id}/messages`,{text:'  ',clientId:randomUUID()})).statusCode,400);
  assert.equal((await call(b,'GET','/api/v1/chats')).json()[0].unread,1);
  assert.equal((await call(b,'GET','/api/v1/chats/unread-count')).json().count,1);
  assert.equal((await call(a,'GET','/api/v1/chats/unread-count')).json().count,0);
  assert.equal((await call(c,'GET','/api/v1/chats/unread-count')).json().count,0);
  await call(b,'POST',`/api/v1/chats/${id}/read`,{messageId:sent.json().id});
  assert.equal((await call(b,'GET','/api/v1/chats')).json()[0].unread,0);
  assert.equal((await call(b,'GET','/api/v1/chats/unread-count')).json().count,0);
  await call(b,'POST',`/api/v1/chats/${id}/messages`,{text:'Здравствуйте! Да, диск в отличном состоянии. Могу отправить завтра.',clientId:randomUUID()});
  assert.equal((await call(a,'GET',`/api/v1/chats/${id}/messages`)).json().items.length,2);
  const direct=(await call(a,'POST','/api/v1/chats',{userId:b.id})).json().id;
  assert.equal((await call(b,'POST','/api/v1/chats',{userId:a.id})).json().id,direct);
  await app.prisma.chatMessage.createMany({data:Array.from({length:60},(_,i)=>({chatId:direct,authorId:a.id,text:String(i),clientId:randomUUID(),createdAt:new Date(Date.now()+i)}))});
  const page=(await call(b,'GET',`/api/v1/chats/${direct}/messages`)).json();assert.equal(page.items.length,50);assert.equal(page.hasMore,true);
  const older=(await call(b,'GET',`/api/v1/chats/${direct}/messages?before=${page.items[0].id}`)).json();assert.equal(older.items.length,10);assert.equal(older.hasMore,false);
  assert.equal(new Set([...older.items,...page.items].map(m=>m.id)).size,60);
  await app.prisma.chat.delete({where:{id:direct}});
  await app.prisma.user.update({where:{id:b.id},data:{...await statusWrite(app.prisma,'User',{status:'suspended'})}});
  assert.equal((await call(a,'POST',`/api/v1/chats/${id}/messages`,{text:'blocked',clientId:randomUUID()})).statusCode,400);
  await app.prisma.user.update({where:{id:b.id},data:{...await statusWrite(app.prisma,'User',{status:'active'})}});
  if(process.env.CHATS_KEEP_PREVIEW==='true'){
   const {writeFile}=await import('node:fs/promises');await writeFile('.deploy/chat-preview.json',JSON.stringify({chatId:id,entryId:entry.id,userId:a.id,cookie:a.cookie}));
  }
 }finally{
  if(process.env.CHATS_KEEP_PREVIEW!=='true'){
   await app.prisma.chat.deleteMany({where:{members:{some:{userId:{in:users.map(u=>u.id)}}}}});
   await app.prisma.marketEntry.deleteMany({where:{gameId}});await app.prisma.game.deleteMany({where:{id:gameId}});await app.prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  }
  await app.close();
 }
});
