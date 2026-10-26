import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const isTestDatabase = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('public catalogue and filter endpoints expose rows created in PostgreSQL, without seed', {
  skip: !isTestDatabase ? 'Runs only against the isolated CI database discvault_ci.' : false,
}, async () => {
  const uploads = await mkdtemp(join(tmpdir(), 'discvault-api-test-'));
  process.env.UPLOAD_DIR = uploads;
  process.env.S3_ENDPOINT = '';
  process.env.S3_BUCKET = '';
  const { buildApp } = await import('../server/src/app.ts');
  const app = await buildApp();
  const id = 'ci-catalog-' + randomUUID();
  const ownerId=randomUUID();
  try {
    await app.prisma.game.create({ data: {
      id, title: 'PostgreSQL catalogue fixture', publisher: 'Test', year: null,
      genres: ['Test'], description: 'Database-only fixture, never deployed to production.',
      editions: { create: { id: id + '-edition', name: 'Database edition', platform: 'CI Platform',
        region: 'CI Region', lang: 'CI Language', media: 'Disc', contents: [], coverImages: [] } },
    } });
    const games = await app.inject({ method: 'GET', url: '/api/v1/catalog/games?q=' + encodeURIComponent('PostgreSQL catalogue fixture') });
    assert.equal(games.statusCode, 200);
    assert.equal(games.json().items[0].id, id);
    assert.equal(games.json().items[0].year, null);
    for (const title of ['PostgreSQL catalogue fixture', ' POSTGRESQL   catalogue fixture ']) {
      await assert.rejects(app.prisma.game.create({data: {
        id: id + '-duplicate', title, publisher: '', year: null, genres: [], description: '',
      }}), (error: unknown) => (error as {code?: string}).code === 'P2002');
    }
    const editions = await app.inject({ method: 'GET', url: '/api/v1/catalog/editions?gameId=' + id });
    assert.equal(editions.statusCode, 200);
    assert.equal(editions.json().items[0].platform, 'CI Platform');
    const filters = await app.inject({ method: 'GET', url: '/api/v1/catalog/filters' });
    assert.equal(filters.statusCode, 200);
    assert.ok(filters.json().platforms.some((platform: { name: string }) => platform.name === 'CI Platform'));
    assert.ok(filters.json().editions.includes('Database edition'));
    const importedId = id + '-dns';
    const input = join(uploads, 'catalog.json');
    await writeFile(input, JSON.stringify({warnings: [], games: [{
      id: importedId, title: 'DNS fixture ' + id, genres: ['Test'], productIds: [importedId + '-sku'],
      platforms: [{name: 'PS5', editions: [{id: importedId + '-sku', name: 'Standard', platforms: ['PS5'],
        images: ['https://c.dns-shop.ru/thumb/st1/fit/500/500/test/cover.jpg.webp'], interfaceLanguages: ['русский'],
        voiceLanguages: [], releaseDate: '2024-01-02'}]}],
    }]}));
    const runImport = (...args: string[]) => JSON.parse(execFileSync(process.execPath,
      [resolve('scripts/import-dns-catalog.cjs'), input, ...args],
      {cwd: resolve('server'), encoding: 'utf8', timeout: 30000}));
    const preview = runImport();
    assert.equal(preview.createGames, 1);
    assert.equal(preview.createEditions, 1);
    assert.equal(await app.prisma.game.count({where: {id: importedId}}), 0);
    const applied = runImport('--apply', '--expect=' + preview.hash);
    assert.equal(applied.mode, 'applied');
    const imported = await app.prisma.game.findUniqueOrThrow({where: {id: importedId}, include: {editions: true}});
    assert.equal(imported.year, null);
    assert.equal(imported.editions[0]?.dnsProductId, importedId + '-sku');
    assert.equal(imported.editions[0]?.coverImages.length, 1);
    assert.equal(runImport().createGames, 0);
    assert.equal(runImport().createEditions, 0);
    const canonicalId=importedId+'-sku',aliasId=importedId+'-variant';
    await app.prisma.edition.create({data:{id:aliasId,gameId:importedId,name:'Standard',platform:'PS5',
      region:'Не указан',lang:'русский',media:'Не указан',contents:[],coverImages:['https://c.dns-shop.ru/thumb/st1/fit/500/500/test/back.jpg.webp'],description:'Отличающийся вариант озвучки.'}});
    await app.prisma.user.create({data:{id:ownerId,email:ownerId+'@test.invalid',displayName:'CI owner'}});
    const copy=await app.prisma.copy.create({data:{userId:ownerId,editionId:aliasId,notes:'Keep user notes'}});
    const listing=await app.prisma.marketEntry.create({data:{id:id+'-listing',authorId:ownerId,kind:'listing',listingType:'sale',gameId:importedId,
      editionId:aliasId,title:'CI listing',condition:'Test',priceMinor:100,description:'Keep listing text',deliveryServices:[],shipsFrom:''}});
    const dedupPreview=runImport();
    assert.equal(dedupPreview.duplicateGroups,1);
    const dedupResult=runImport('--apply','--expect='+dedupPreview.hash);
    assert.deepEqual(dedupResult.reassigned,{copies:1,marketEntries:1});
    assert.equal((await app.prisma.copy.findUniqueOrThrow({where:{id:copy.id}})).editionId,canonicalId);
    assert.equal((await app.prisma.copy.findUniqueOrThrow({where:{id:copy.id}})).notes,'Keep user notes');
    assert.equal((await app.prisma.marketEntry.findUniqueOrThrow({where:{id:listing.id}})).editionId,canonicalId);
    assert.equal((await app.prisma.edition.findUniqueOrThrow({where:{id:aliasId}})).canonicalId,canonicalId);
    const visible=await app.inject({method:'GET',url:'/api/v1/catalog/editions?gameId='+importedId});
    assert.equal(visible.json().total,1);
    assert.equal(visible.json().items[0].variants[0].id,aliasId);
    const oldLink=await app.inject({method:'GET',url:'/api/v1/catalog/editions/'+aliasId});
    assert.equal(oldLink.statusCode,200);assert.equal(oldLink.json().id,canonicalId);
    assert.equal(runImport().duplicateGroups,0);
    const scan='https://showgames.ru/image/cache/catalog/covers/ps5/fixture-855x1000.jpg';
    const sourceProduct={id:importedId+'-sku',name:'Standard',platforms:['PS5'],images:['https://c.dns-shop.ru/thumb/st1/fit/500/500/test/cover.jpg.webp'],interfaceLanguages:['русский']};
    await writeFile(input,JSON.stringify({warnings:[],games:[{id:importedId,title:'DNS fixture '+id,productIds:[sourceProduct.id,'showgames-'+id],platforms:[{name:'PS5',editions:[sourceProduct,
      {id:'showgames-'+id,sourceProvider:'showgames',name:'Standard',platforms:['PS5'],images:[scan],interfaceLanguages:['русский']},
    ]}]}]}));
    const scansPreview=runImport();
    assert.equal(scansPreview.createGames,0);assert.equal(scansPreview.createEditions,1);
    runImport('--apply','--expect='+scansPreview.hash);
    const refreshed=await app.prisma.edition.findUniqueOrThrow({where:{id:canonicalId}});
    assert.equal(refreshed.coverImages[0],scan);
    assert.ok(refreshed.coverImages.includes(sourceProduct.images[0]!));
    assert.ok(refreshed.coverImages.some(url=>url.includes('/back.jpg')));
    assert.equal((await app.prisma.copy.findUniqueOrThrow({where:{id:copy.id}})).editionId,canonicalId);
    assert.equal(runImport().createEditions,0);assert.equal(runImport().updateEditions,0);assert.equal(runImport().duplicateGroups,0);
  } finally {
    await app.prisma.marketEntry.deleteMany({where:{id:id+'-listing'}});
    await app.prisma.user.deleteMany({where:{id:ownerId}});
    await app.prisma.edition.deleteMany({where:{gameId:{in:[id,id+'-dns']},canonicalId:{not:null}}});
    await app.prisma.game.deleteMany({ where: { id: {in: [id, id + '-dns']} } });
    await app.close();
    await rm(uploads, { recursive: true, force: true });
  }
});
