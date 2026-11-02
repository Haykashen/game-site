import { moderationStatus, statusWhere } from '../lib/statusSource.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../lib/validation.js';
import { badRequest, notFound } from '../errors.js';
import { isPrismaError } from '../lib/prismaErrors.js';

const person = { id:true, displayName:true, avatarUrl:true } as const;
export function registerChatRoutes(app: FastifyInstance) {
  const auth = { preHandler: app.authenticate };
  const member = async (id:string,userId:string) => {
    if(!await app.prisma.chatMember.findUnique({where:{chatId_userId:{chatId:id,userId}}})) throw notFound('Чат не найден.');
  };
  app.post('/api/v1/chats', {...auth,config:{rateLimit:{max:20,timeWindow:'1 minute'}}}, async request => {
    const input=parse(z.object({entryId:z.string().min(1).max(200).optional(),userId:z.string().uuid().optional()}).refine(v=>Boolean(v.entryId)!==Boolean(v.userId)),request.body);
    const me=request.user!.id;
    let target=input.userId, title='Личная переписка';
    if(input.entryId){
      const entry=await app.prisma.marketEntry.findUnique({ include: {statusReference: {select: {code: true}}},where:{id:input.entryId}});
      if(!entry||entry.deletedAt||moderationStatus(entry)!=='visible')throw notFound('Объявление недоступно.');
      target=entry.authorId;title=entry.title;
    }
    if(target===me)throw badRequest('Нельзя написать самому себе.');
    if(!await app.prisma.user.findFirst({ include: {statusReference: {select: {code: true}}},where:{id:target!,...statusWhere('active')}}))throw notFound('Пользователь недоступен.');
    const key=[input.entryId??'direct',...[me,target!].sort()].join(':');
    const chat=await app.prisma.chat.upsert({where:{key},update:{},create:{key,title,entryId:input.entryId??null,members:{create:[{userId:me},{userId:target!}]}}}).catch(async error=>{
      if(!isPrismaError(error,'P2002'))throw error;
      return app.prisma.chat.findUniqueOrThrow({where:{key}});
    });
    return {id:chat.id};
  });
  app.get('/api/v1/chats',auth,async request=>{
    const me=request.user!.id;
    const chats=await app.prisma.chat.findMany({where:{members:{some:{userId:me}}},include:{members:{include:{user:{select:person}}},messages:{orderBy:[{createdAt:'desc'},{id:'desc'}],take:1}},orderBy:[{updatedAt:'desc'},{id:'desc'}]});
    const entries=await app.prisma.marketEntry.findMany({where:{id:{in:chats.flatMap(c=>c.entryId?[c.entryId]:[])}},select:{ statusReference: { select: { code: true } },id:true,kind:true}});
    return Promise.all(chats.map(async c=>({...c,entryKind:entries.find(e=>e.id===c.entryId)?.kind??null,members:c.members.map(m=>({user:m.user,readAt:m.readAt})),unread:await app.prisma.chatMessage.count({where:{chatId:c.id,authorId:{not:me},createdAt:{gt:c.members.find(m=>m.userId===me)!.readAt}}})})));
  });
  app.get('/api/v1/chats/:id/messages',auth,async request=>{
    const {id}=parse(z.object({id:z.string().uuid()}),request.params);await member(id,request.user!.id);
    const {before}=parse(z.object({before:z.string().uuid().optional()}),request.query);
    if(before&&!await app.prisma.chatMessage.findFirst({where:{id:before,chatId:id}}))throw notFound();
    const rows=await app.prisma.chatMessage.findMany({where:{chatId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,...(before?{cursor:{id:before},skip:1}:{})});
    return {items:rows.slice(0,50).reverse(),hasMore:rows.length>50};
  });
  app.post('/api/v1/chats/:id/read',auth,async request=>{
    const {id}=parse(z.object({id:z.string().uuid()}),request.params);await member(id,request.user!.id);
    const {messageId}=parse(z.object({messageId:z.string().uuid()}),request.body);
    const message=await app.prisma.chatMessage.findFirst({where:{id:messageId,chatId:id}});if(!message)throw notFound();
    await app.prisma.chatMember.updateMany({where:{chatId:id,userId:request.user!.id,readAt:{lt:message.createdAt}},data:{readAt:message.createdAt}});return {ok:true};
  });
  app.post('/api/v1/chats/:id/messages',{...auth,config:{rateLimit:{max:30,timeWindow:'1 minute'}}},async request=>{
    const {id}=parse(z.object({id:z.string().uuid()}),request.params);const me=request.user!.id;await member(id,me);
    const {text,clientId}=parse(z.object({text:z.string().trim().min(1).max(4000),clientId:z.string().uuid()}),request.body);
    return app.prisma.$transaction(async tx=>{
      if(await tx.chatMember.count({where:{chatId:id,user:{...statusWhere({not:'active'})}}}))throw badRequest('Переписка с этим пользователем недоступна.');
      const existing=await tx.chatMessage.findUnique({where:{authorId_clientId:{authorId:me,clientId}}});
      if(existing){if(existing.chatId!==id||existing.text!==text)throw badRequest('Идентификатор сообщения уже использован.');return existing;}
      const message=await tx.chatMessage.create({data:{chatId:id,authorId:me,text,clientId}});
      await tx.chat.update({where:{id},data:{updatedAt:new Date()}});return message;
    });
  });
}
