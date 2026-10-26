const { createHash } = require('node:crypto');
const titleKey = title => title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’‘`']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const existingAliases = new Map(Object.entries({
  'God of War': 'God of War (2018)',
  "Marvel's Spider-Man": "Marvel's Spider-Man (2018)",
  'Resident Evil 2': 'Resident Evil 2 (2019)',
  'Resident Evil 4 Remake': 'Resident Evil 4 (2023)',
}).map(([from,to]) => [titleKey(from),titleKey(to)]));

function coverImages(urls) {
  const assets = new Map();
  for (const url of urls) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'c.dns-shop.ru') throw Error('Unexpected cover URL: ' + url);
    const asset = parsed.pathname.split('/').pop().replace(/(?:\.(?:webp|jpe?g|png))+$/i, '');
    const size = +(parsed.pathname.match(/\/fit\/(\d+)\//)?.[1] ?? 0);
    const previous = assets.get(asset);
    if (!previous || size > previous.size) assets.set(asset, { url, size });
  }
  return [...assets.values()].map(asset => asset.url);
}
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }

function planCatalog(document, games, editions) {
  if (!Array.isArray(document.games) || !document.games.length || document.warnings?.length) throw Error('Invalid or unresolved source catalogue');
  const gamesByKey = new Map(), gamesById = new Map(games.map(g=>[g.id,g]));
  for (const game of games) {
    const normalized = titleKey(game.title);
    if (gamesByKey.has(normalized)) throw Error('Ambiguous existing game titles: ' + game.title);
    gamesByKey.set(normalized, game);
  }
  const editionById = new Map(editions.map(e=>[e.id,e]));
  const sourceKeys = new Set(), sourceIds = new Set(), targetIds = new Set(), targetEditionIds = new Set();
  const createGames = [], updateGames = [], createEditions = [], updateEditions = [], mappings = [];
  for (const source of document.games) {
    if (!source.id || !source.title?.trim() || !Array.isArray(source.platforms)) throw Error('Invalid game');
    const normalized = titleKey(source.title);
    if (sourceKeys.has(normalized) || sourceIds.has(source.id)) throw Error('Duplicate source game: ' + source.title);
    sourceKeys.add(normalized); sourceIds.add(source.id);
    const alias = existingAliases.get(normalized);
    const existing = gamesByKey.get(normalized) ?? (alias ? gamesByKey.get(alias) : undefined);
    if (!existing && gamesById.has(source.id)) throw Error('Game ID collision: ' + source.id);
    const gameId = existing?.id ?? source.id;
    if (targetIds.has(gameId)) throw Error('Multiple source groups target one game: ' + gameId);
    targetIds.add(gameId);
    const firstImages = source.platforms.flatMap(p=>p.editions).find(e=>e.images?.length)?.images ?? [];
    const coverImage = coverImages(firstImages)[0] ?? '';
    if (!existing) createGames.push({ id: gameId, title: source.title.trim(), publisher: '', developer: '', series: '', year: null, genres: source.genres ?? [], description: '', coverImage });
    else if (!existing.coverImage && coverImage) updateGames.push({ id: gameId, data: { coverImage } });
    mappings.push({ sourceId: source.id, gameId, sourceTitle: source.title, title: existing?.title ?? source.title, matched: Boolean(existing) });
    for (const platform of source.platforms) {
      if (!['PS3','PS4','PS5'].includes(platform.name)) throw Error('Unresolved platform: ' + platform.name);
      for (const product of platform.editions) {
        if (!source.productIds.includes(product.id) || !product.platforms.includes(platform.name)) throw Error('Product/platform mismatch: ' + product.id);
        const covers = coverImages(product.images ?? []);
        const id = product.platforms.length > 1 ? `${product.id}-${platform.name.toLowerCase()}` : product.id;
        const matches = editions.filter(e=>e.dnsProductId === product.id && e.platform === platform.name);
        if (matches.length > 1) throw Error('Ambiguous existing DNS edition: ' + product.id);
        const prior = matches[0] ?? editionById.get(id);
        if (prior && (prior.gameId !== gameId || prior.platform !== platform.name || (prior.dnsProductId && prior.dnsProductId !== product.id))) throw Error('Edition identity collision: ' + id);
        const targetId = prior?.id ?? id;
        if (targetEditionIds.has(targetId)) throw Error('Duplicate target edition: ' + targetId);
        targetEditionIds.add(targetId);
        if (prior) {
          const data = {};
          // Preserve non-DNS artwork supplied by users or the existing catalogue.
          if ((!prior.coverImages.length || prior.coverImages.every(url=>url.startsWith('https://c.dns-shop.ru/'))) && !same(prior.coverImages,covers)) data.coverImages = covers;
          if (!prior.dnsProductId) data.dnsProductId = product.id;
          if (!prior.dnsProductCode && product.code) data.dnsProductCode = product.code;
          if (Object.keys(data).length) updateEditions.push({ id: prior.id, data });
        } else {
          const description = [product.ageRating ? `Возрастное ограничение: ${product.ageRating}.` : '', product.voiceLanguages?.length ? `Озвучка: ${product.voiceLanguages.join(', ')}.` : ''].filter(Boolean).join(' ');
          createEditions.push({ id, gameId, name: product.name === 'стандартное издание' ? 'Standard' : product.name,
            platform: platform.name, region: 'Не указан', lang: product.interfaceLanguages?.join(', ') || 'Не указан', media: 'Не указан',
            releaseDate: product.releaseDate ? new Date(product.releaseDate + 'T00:00:00.000Z') : null,
            description, contents: [], coverImages: covers, barcode: '', dnsProductId: product.id, dnsProductCode: product.code ?? '' });
        }
      }
    }
  }
  const plan = { createGames, updateGames, createEditions, updateEditions, mappings };
  const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { ...plan, hash, summary: { sourceGames: document.games.length, matchedGames: mappings.filter(m=>m.matched).length,
    createGames: createGames.length, updateGameCovers: updateGames.length, createEditions: createEditions.length, updateEditions: updateEditions.length,
    beforeGames: games.length, afterGames: games.length + createGames.length, beforeEditions: editions.length, afterEditions: editions.length + createEditions.length,
    sourceProducts: new Set(document.games.flatMap(g=>g.productIds)).size } };
}
module.exports = { titleKey, coverImages, planCatalog };
