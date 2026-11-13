import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('editions have no independent moderation or language columns', {skip: !isolated}, async () => {
 const db = new PrismaClient();
 try {
 const columns = await db.$queryRaw<{column_name:string}[]>`SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='editions' AND column_name IN ('lang','status_id','moderation_note','moderated_at','moderator_id')`;
 assert.deepEqual(columns,[]);
 } finally {await db.$disconnect();}
});
