import { marketStatus, moderationStatus, statusWrite } from '../server/src/lib/statusSource.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('status references are the only persisted lifecycle source and reject cross-entity assignments', {skip: !isolated}, async () => {
  const db = new PrismaClient();
  const id = randomUUID();
  try {
    const draft = await db.status.findFirstOrThrow({where:{entity:'Game',code:'draft'}});
    const checked = await db.status.findFirstOrThrow({where:{entity:'Game',code:'visible'}});
    const game = await db.game.create({data:{id, title:id, publisher:'', description:''}});
    assert.equal(game.statusId, draft.id);
    const approved = await db.game.update({where:{id},data:{statusId:checked.id},include:{statusReference:true}});
    assert.equal(moderationStatus(approved), 'visible');
    const user = await db.user.create({data:{id,email:id+'@test.invalid',displayName:'Status test'}});
    assert.equal((await db.status.findUniqueOrThrow({where:{id:user.statusId}})).code,'active');
    const entry = await db.marketEntry.create({data:{id,authorId:id,gameId:id,kind:'auction',itemType:'figure',title:id,condition:'New',priceMinor:100,description:'Test',deliveryServices:[],shipsFrom:'Test'}});
    assert.equal((await db.status.findUniqueOrThrow({where:{id:entry.statusId}})).code,'pending');
    const active = await db.status.findFirstOrThrow({where:{entity:'Auction',code:'active'}});
    const published = await db.marketEntry.update({where:{id},data:{statusId:active.id},include:{statusReference:true}});
    assert.equal(marketStatus(published),'active');assert.equal(moderationStatus(published),'visible');
    const sold = await db.marketEntry.update({where:{id},data:await statusWrite(db,'MarketEntry',{status:'sold'},id)});
    assert.equal((await db.status.findUniqueOrThrow({where:{id:sold.statusId}})).code,'sold');
    const closed = await db.status.findFirstOrThrow({where:{entity:'Auction',code:'closed'}});
    const stopped = await db.marketEntry.update({where:{id},data:{statusId:closed.id},include:{statusReference:true}});
    assert.equal(marketStatus(stopped),'closed');
    await assert.rejects(db.game.update({where:{id},data:{statusId:closed.id}}));
    // Changing kind without remapping the reference must also be rejected.
    await assert.rejects(db.marketEntry.update({where:{id},data:{kind:'listing'}}));
    const columns = await db.$queryRaw<{column_name: string}[]>`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('games','editions','market_entries','news_posts','discussions','users','deals','reports') AND column_name IN ('status','moderation_status')`;
    assert.deepEqual(columns, []);
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
