import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const allowed = (process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci')) ||
  (process.env.COMMUNITY_LOCAL_TESTS === 'true' && (process.env.DATABASE_URL ?? '').includes('localhost:51218/'));

test('community: submissions stay private until approval; permissions, rejection and edit review', {skip: !allowed}, async () => {
  process.env.S3_ENDPOINT = ''; process.env.S3_BUCKET = '';
  const {buildApp} = await import('../server/src/app.js');
  const app = await buildApp();
  const users: {id: string; cookie: string}[] = [];
  const gameId = 'community-test-' + randomUUID();
  try {
    for (const name of ['Автор', 'Читатель', 'Модератор']) {
      const r = await app.inject({method:'POST', url:'/api/v1/auth/register', payload:{email:randomUUID()+'@test.local',password:'LocalTest123!',displayName:name}});
      assert.equal(r.statusCode,201,r.body);
      users.push({id:r.json().user.id,cookie:r.cookies.map(c=>c.name+'='+c.value).join('; ')});
    }
    const [author,reader,moderator] = users as [typeof users[number],typeof users[number],typeof users[number]];
    await app.prisma.user.update({where:{id:moderator.id},data:{role:'moderator'}});
    await app.prisma.game.create({data:{id:gameId,title:gameId,publisher:'',description:''}});
    const call = (user: typeof author | null, method: 'GET'|'POST'|'PATCH', url: string, payload?: unknown) => app.inject({method,url,...(user ? {headers:{cookie:user.cookie}} : {}),...(payload ? {payload}: {})});
    for (const kind of ['news','discussions']) {
      const base = '/api/v1/' + kind;
      const input = {title:'Публикация коллекционера',body:'Полный текст публикации о коллекционировании.',gameId,category:'community',tags:['коллекция'],moderationStatus:'visible'};
      assert.equal((await call(null,'POST',base,input)).statusCode,401);
      const created = await call(author,'POST',base,input);
      assert.equal(created.statusCode,201,created.body);
      const post = created.json();
      assert.equal(post.moderationStatus,'pending');
      const id = post.id;
      assert.equal((await call(null,'GET',base+'?q='+gameId)).json().total,0);
      assert.equal((await call(reader,'GET',base+'/'+id)).statusCode,404);
      assert.equal((await call(null,'GET',base+'/'+id)).statusCode,404);
      assert.equal((await call(author,'GET',base+'/'+id)).statusCode,200);
      assert.equal((await call(author,'GET',base+'?scope=mine')).json().items.some((p:{id:string})=>p.id===id),true);
      assert.equal((await call(reader,'GET',base+'?scope=mine')).json().items.some((p:{id:string})=>p.id===id),false);
      assert.equal((await call(author,'GET',base+'?scope=pending')).statusCode,403);
      assert.equal((await call(null,'GET',base+'?scope=mine')).statusCode,401);
      assert.equal((await call(moderator,'GET',base+'?scope=pending')).json().items.some((p:{id:string})=>p.id===id),true);
      const decision = {status:'visible',note:'',updatedAt:post.updatedAt};
      assert.equal((await call(author,'PATCH',base+'/'+id+'/moderation',decision)).statusCode,403);
      assert.equal((await call(moderator,'PATCH',base+'/'+id+'/moderation',{...decision,updatedAt:new Date(0).toISOString()})).statusCode,409);
      if (kind === 'discussions') assert.equal((await call(reader,'POST',base+'/'+id+'/comments',{body:'Комментарий до проверки'})).statusCode,404);
      const approval = await call(moderator,'PATCH',base+'/'+id+'/moderation',decision);
      assert.equal(approval.statusCode,204,approval.body);
      assert.equal((await call(null,'GET',base+'/'+id)).json().moderationStatus,'visible');
      assert.equal((await call(null,'GET',base+'?q='+gameId)).json().items.some((p:{id:string})=>p.id===id),true);
      assert.equal((await call(moderator,'PATCH',base+'/'+id+'/moderation',decision)).statusCode,409);
      if (kind === 'discussions') {
        assert.equal((await call(reader,'POST',base+'/'+id+'/comments',{body:'Обсуждаем одобренную тему'})).statusCode,201);
        const edited = await call(author,'PATCH',base+'/'+id,{body:'Изменённый текст требует повторной проверки.'});
        assert.equal(edited.statusCode,200,edited.body);
        assert.equal(edited.json().moderationStatus,'pending');
        assert.equal((await call(reader,'GET',base+'/'+id)).statusCode,404);
      }
      const second = (await call(author,'POST',base,{...input,title:'Вторая публикация'})).json();
      const reject = {status:'hidden',updatedAt:second.updatedAt,note:''};
      assert.equal((await call(moderator,'PATCH',base+'/'+second.id+'/moderation',reject)).statusCode,400);
      assert.equal((await call(moderator,'PATCH',base+'/'+second.id+'/moderation',{...reject,note:'Дополните источник информации.'})).statusCode,204);
      const own = (await call(author,'GET',base+'/'+second.id)).json();
      assert.equal(own.moderationStatus,'hidden');
      assert.equal(own.moderationNote,'Дополните источник информации.');
      assert.equal((await call(reader,'GET',base+'/'+second.id)).statusCode,404);
    }
  } finally {
    await app.prisma.discussion.deleteMany({where:{gameId}});
    await app.prisma.newsPost.deleteMany({where:{gameId}});
    await app.prisma.game.deleteMany({where:{id:gameId}});
    await app.prisma.user.deleteMany({where:{id:{in:users.map(user=>user.id)}}});
    await app.close();
  }
});
