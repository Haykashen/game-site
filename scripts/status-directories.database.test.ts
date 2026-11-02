import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('status references persist and stay consistent through lifecycle and compatibility writes', {skip: !isolated}, async () => {
  const db = new PrismaClient();
  const id = randomUUID();
  try {
    const draft = await db.gameStatus.findUniqueOrThrow({where:{code:'draft'}});
    const checked = await db.gameStatus.findUniqueOrThrow({where:{code:'visible'}});
    const game = await db.game.create({data:{id, title:id, publisher:'', description:''}});
    assert.equal(game.statusId, draft.id);
    const approved = await db.game.update({where:{id},data:{statusId:checked.id}});
    assert.equal(approved.moderationStatus, 'visible');
    const user = await db.user.create({data:{id,email:id+'@test.invalid',displayName:'Status test'}});
    assert.equal((await db.accountStatus.findUniqueOrThrow({where:{id:user.statusId}})).code,'active');
    const entry = await db.marketEntry.create({data:{id,authorId:id,gameId:id,kind:'auction',itemType:'figure',title:id,condition:'New',priceMinor:100,description:'Test',deliveryServices:[],shipsFrom:'Test'}});
    assert.equal((await db.marketEntryStatus.findUniqueOrThrow({where:{id:entry.statusId}})).code,'pending');
    const active = await db.marketEntryStatus.findUniqueOrThrow({where:{code:'active'}});
    const published = await db.marketEntry.update({where:{id},data:{statusId:active.id}});
    assert.equal(published.status,'active');assert.equal(published.moderationStatus,'visible');
    const sold = await db.marketEntry.update({where:{id},data:{status:'sold'}});
    assert.equal((await db.marketEntryStatus.findUniqueOrThrow({where:{id:sold.statusId}})).code,'sold');
    const closed = await db.marketEntryStatus.findUniqueOrThrow({where:{code:'closed'}});
    const stopped = await db.marketEntry.update({where:{id},data:{statusId:closed.id}});
    assert.equal(stopped.status,'closed');
    await assert.rejects(db.game.update({where:{id},data:{statusId:closed.id}}));
  } finally {
    await db.marketEntry.deleteMany({where:{id}});
    await db.game.deleteMany({where:{id}});
    await db.user.deleteMany({where:{id}});
    await db.$disconnect();
  }
});
