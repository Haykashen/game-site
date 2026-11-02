import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('status references persist and stay consistent through lifecycle and compatibility writes', {skip: !isolated}, async () => {
  const db = new PrismaClient();
  const id = randomUUID();
  try {
    const draft = await db.status.findFirstOrThrow({where:{entity:'Game',code:'draft'}});
    const checked = await db.status.findFirstOrThrow({where:{entity:'Game',code:'visible'}});
    const game = await db.game.create({data:{id, title:id, publisher:'', description:''}});
    assert.equal(game.statusId, draft.id);
    const approved = await db.game.update({where:{id},data:{statusId:checked.id}});
    assert.equal(approved.moderationStatus, 'visible');
    const user = await db.user.create({data:{id,email:id+'@test.invalid',displayName:'Status test'}});
    assert.equal((await db.status.findUniqueOrThrow({where:{id:user.statusId}})).code,'active');
    const entry = await db.marketEntry.create({data:{id,authorId:id,gameId:id,kind:'auction',itemType:'figure',title:id,condition:'New',priceMinor:100,description:'Test',deliveryServices:[],shipsFrom:'Test'}});
    assert.equal((await db.status.findUniqueOrThrow({where:{id:entry.statusId}})).code,'pending');
    const active = await db.status.findFirstOrThrow({where:{entity:'Auction',code:'active'}});
    const published = await db.marketEntry.update({where:{id},data:{statusId:active.id}});
    assert.equal(published.status,'active');assert.equal(published.moderationStatus,'visible');
    const sold = await db.marketEntry.update({where:{id},data:{status:'sold'}});
    assert.equal((await db.status.findUniqueOrThrow({where:{id:sold.statusId}})).code,'sold');
    const closed = await db.status.findFirstOrThrow({where:{entity:'Auction',code:'closed'}});
    const stopped = await db.marketEntry.update({where:{id},data:{statusId:closed.id}});
    assert.equal(stopped.status,'closed');
    await assert.rejects(db.game.update({where:{id},data:{statusId:closed.id}}));
    const editionDraft = await db.status.findFirstOrThrow({where:{entity:'Edition',code:'draft'}});
    assert.notEqual(editionDraft.id,draft.id);
    await assert.rejects(db.status.update({where:{id:draft.id},data:{entity:'Deal'}}));
    await assert.rejects(db.status.update({where:{id:draft.id},data:{code:'another-code'}}));
    assert.equal(await db.status.count({where:{code:'draft'}}),6);
  } finally {
    await db.marketEntry.deleteMany({where:{id}});
    await db.game.deleteMany({where:{id}});
    await db.user.deleteMany({where:{id}});
    await db.$disconnect();
  }
});
