import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerShowcaseReactions} from '../server/src/collection/showcaseReactions.ts';
import {AppError} from '../server/src/errors.ts';
const shareId='11111111-1111-4111-8111-111111111111', commentId='22222222-2222-4222-8222-222222222222';
test('showcase likes are idempotent and comments require authentication and ownership',async()=>{
  const app=Fastify();let liked=false;const comments:any[]=[];
  app.decorate('optionalAuth',async(request)=>{request.user=request.headers['x-user']?{id:String(request.headers['x-user']),role:request.headers['x-role']??'user'} as any:null;});
  app.decorate('authenticate',async(request,reply)=>{if(!request.headers['x-user']){await reply.code(401).send({});return;} request.user={id:String(request.headers['x-user']),role:request.headers['x-role']??'user'} as any;});
  app.decorate('prisma',{
    copyShare:{findFirst:async()=>({id:shareId})},
    copyShareLike:{count:async()=>liked?1:0,findUnique:async()=>liked?{}:null,upsert:async()=>{liked=true;return {};},deleteMany:async()=>{liked=false;return {count:1};}},
    copyShareComment:{count:async()=>comments.length,create:async({data}:any)=>{comments.push({...data,id:commentId});return comments.at(-1);},deleteMany:async({where}:any)=>{const index=comments.findIndex(c=>c.id===where.id&&c.shareId===where.shareId&&(!where.userId||c.userId===where.userId));if(index<0)return {count:0};comments.splice(index,1);return {count:1};}},
  } as any);
  app.setErrorHandler((e,_r,reply)=>reply.code(e instanceof AppError?e.statusCode:500).send({message:e.message}));registerShowcaseReactions(app);
  const base='/api/v1/community/showcase/'+shareId;
  try{
    for(const url of [base+'/like',base+'/comments'])assert.equal((await app.inject({method:url.endsWith('like')?'PUT':'POST',url,payload:url.endsWith('comments')?{body:'Hello'}:undefined})).statusCode,401);
    for(let i=0;i<2;i++){const response=await app.inject({method:'PUT',url:base+'/like',headers:{'x-user':'owner'}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().likesCount,1);assert.equal(response.json().likedByMe,true);}
    assert.equal((await app.inject({method:'DELETE',url:base+'/like',headers:{'x-user':'owner'}})).json().likesCount,0);
    assert.equal((await app.inject({method:'POST',url:base+'/comments',headers:{'x-user':'owner'},payload:{body:'   '}})).statusCode,400);
    const created=await app.inject({method:'POST',url:base+'/comments',headers:{'x-user':'owner'},payload:{body:' Nice copy! '}});assert.equal(created.statusCode,201,created.body);assert.equal(comments[0].body,'Nice copy!');assert.equal(created.json().commentsCount,1);
    assert.equal((await app.inject({method:'DELETE',url:base+'/comments/'+commentId,headers:{'x-user':'other'}})).statusCode,404);
    const removed=await app.inject({method:'DELETE',url:base+'/comments/'+commentId,headers:{'x-user':'moderator','x-role':'moderator'}});assert.equal(removed.statusCode,200,removed.body);assert.equal(removed.json().commentsCount,0);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/community/showcase/invalid/social'})).statusCode,400);
  }finally{await app.close();}
});
