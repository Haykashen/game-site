// Run from the API container's /app/server working directory:
// node /path/import-catalog-games.cjs /path/games-batch-001.json [--apply]
// Only inserts games. Never runs the demo seed or updates existing rows.
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { PrismaClient } = createRequire(resolve(process.cwd(), 'package.json'))('@prisma/client');
const normalize = (title) => title.normalize('NFKC').toLocaleLowerCase('en').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!file) throw new Error('Provide a catalogue batch JSON file. Default mode is read-only.');
  const batch = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(batch.games) || !batch.games.length) throw new Error('Empty or invalid batch');
  const ids = new Set(), titles = new Set();
  const rows = batch.games.map(({ sources, ...game }) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) || ids.has(game.id)) throw new Error('Invalid or duplicate id: ' + game.id);
    for (const field of ['title', 'publisher', 'developer', 'series', 'description']) {
      if (typeof game[field] !== 'string' || !game[field].trim()) throw new Error('Missing ' + field + ': ' + game.id);
    }
    if (!Number.isInteger(game.year) || game.year < 1970 || game.year > new Date().getUTCFullYear()) throw new Error('Invalid year: ' + game.id);
    if (game.coverImage !== '' || !Array.isArray(game.genres) || !game.genres.length || game.genres.some(g => typeof g !== 'string' || !g.trim())) throw new Error('Invalid images or genres: ' + game.id);
    if (!Array.isArray(sources) || !sources.length || sources.some(s => typeof s !== 'string' || !s.startsWith('https://'))) throw new Error('Missing sources: ' + game.id);
    const title = normalize(game.title);
    if (titles.has(title)) throw new Error('Duplicate title: ' + game.title);
    if (Object.keys(game).some(k => !['id','title','publisher','developer','series','year','genres','description','coverImage'].includes(k))) throw new Error('Unexpected game field');
    ids.add(game.id); titles.add(title);
    return game;
  });
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async tx => {
      // Serialize catalogue writers while checking title duplicates and inserting.
      if (apply) await tx.$executeRawUnsafe('LOCK TABLE "games" IN SHARE ROW EXCLUSIVE MODE');
      const existing = await tx.game.findMany();
      const existingIds = new Set(existing.map(g => g.id));
      const existingTitles = new Set(existing.map(g => normalize(g.title)));
      const additions = rows.filter(g => !existingIds.has(g.id) && !existingTitles.has(normalize(g.title)));
      const relatedCounts = async () => ({ users: await tx.user.count(), editions: await tx.edition.count(), copies: await tx.copy.count(), marketEntries: await tx.marketEntry.count(), bids: await tx.bid.count(), deals: await tx.deal.count(), ratings: await tx.gameRating.count() });
      const before = await relatedCounts();
      if (apply && additions.length) {
        const data = [];
        for (const {series, ...game} of additions) {
          const entry = series.trim() ? await tx.gameSeries.upsert({where: {name: series.trim()}, create: {name: series.trim()}, update: {}}) : null;
          const {genres,...fields}=game;const names=[...new Set(genres.flatMap(name=>name.trim().toLowerCase()==='action rpg'?['Action','RPG']:[name.trim()]))];const ids=[];for(const name of names) ids.push(await tx.gameGenre.upsert({where:{name},create:{name},update:{}}));data.push({...fields,seriesId:entry?.id??null,genres:{connect:ids.map(({id})=>({id}))}});
        }
        for(const record of data) await tx.game.create({data:record});
      }
      const unchanged = await tx.game.findMany({ where: { id: { in: existing.map(g => g.id) } } });
      const sorted = values => JSON.stringify(values.sort((a,b) => a.id.localeCompare(b.id)));
      if (sorted(existing) !== sorted(unchanged)) throw new Error('Existing games changed; rolling back');
      const after = await relatedCounts();
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Related table counts changed; rolling back');
      return { batch: batch.batch, mode: apply ? 'applied' : 'preview', before: existing.length, inserted: apply ? additions.length : 0, planned: additions.map(g => ({ id: g.id, title: g.title, year: g.year })), skipped: rows.filter(g => !additions.includes(g)).map(g => g.id), after: await tx.game.count(), relatedTables: after, existingGamesUnchanged: true };
    }, { timeout: 30000, isolationLevel: 'Serializable' });
    console.log(JSON.stringify(result, null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
