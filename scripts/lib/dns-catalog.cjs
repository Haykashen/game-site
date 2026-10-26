const { createHash } = require('node:crypto');
const {expandProducts,planEditionDedup}=require('./edition-dedup.cjs');
const {prioritizeImages}=require('./cover-images.cjs');
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
    if (parsed.protocol !== 'https:' || !['c.dns-shop.ru','showgames.ru'].includes(parsed.hostname)) throw Error('Unexpected cover URL: ' + url);
    const asset = parsed.hostname+'/'+(parsed.hostname==='showgames.ru'?parsed.pathname:parsed.pathname.split('/').pop().replace(/(?:\.(?:webp|jpe?g|png))+$/i, ''));
    const size = +(parsed.pathname.match(/\/fit\/(\d+)\//)?.[1] ?? 0);
    const previous = assets.get(asset);
    if (!previous || size > previous.size) assets.set(asset, { url, size });
  }
  return prioritizeImages([...assets.values()].map(asset => asset.url));
}
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }

function planCatalog(document, games, editions) {
  document=expandProducts(document);
  editions=[...new Map(editions.flatMap(e=>[e,...(e.variants??[]).map(v=>({...v,canonicalId:e.id}))]).map(e=>[e.id,e])).values()];
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
    const firstImages = source.platforms.flatMap(p=>p.editions).flatMap(e=>e.images??[]);
    const coverImage = coverImages(firstImages)[0] ?? '';
    if (!existing) createGames.push({ id: gameId, title: source.title.trim(), publisher: '', developer: '', series: '', year: null, genres: source.genres ?? [], description: '', coverImage });
    else if (coverImage && existing.coverImage!==coverImage && (!existing.coverImage || (coverImage.startsWith('https://showgames.ru/') && /^https:\/\/(c\.dns-shop\.ru|showgames\.ru)\//.test(existing.coverImage)))) updateGames.push({ id: gameId, data: { coverImage } });
    mappings.push({ sourceId: source.id, gameId, sourceTitle: source.title, title: existing?.title ?? source.title, matched: Boolean(existing) });
    for (const platform of source.platforms) {
      if (!['PS3','PS4','PS5','Xbox One','Xbox 360','Xbox Series X','Xbox Series S','Nintendo Switch','Nintendo Switch 2'].includes(platform.name)) throw Error('Unresolved platform: ' + platform.name);
      for (const product of platform.editions) {
        if (!source.productIds.includes(product.id) || !product.platforms.includes(platform.name)) throw Error('Product/platform mismatch: ' + product.id);
        const covers = coverImages(product.images ?? []);
        const isShowgames=product.sourceProvider==='showgames';
        const id = isShowgames || product.platforms.length > 1 ? `${product.id}-${platform.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}` : product.id;
        const matches = isShowgames?[]:editions.filter(e=>e.dnsProductId === product.id && e.platform === platform.name);
        if (matches.length > 1) throw Error('Ambiguous existing DNS edition: ' + product.id);
        const prior = matches[0] ?? editionById.get(id);
        if (prior && (prior.gameId !== gameId || prior.platform !== platform.name || (!isShowgames && prior.dnsProductId && prior.dnsProductId !== product.id))) throw Error('Edition identity collision: ' + id);
        const targetId = prior?.id ?? id;
        if (targetEditionIds.has(targetId)) throw Error('Duplicate target edition: ' + targetId);
        targetEditionIds.add(targetId);
        if (prior) {
          const data = {};
          // Preserve non-DNS artwork supplied by users or the existing catalogue.
          const combined=prioritizeImages([...covers,...prior.coverImages]);
          if (!same(prior.coverImages,combined)) data.coverImages = combined;
          if (!isShowgames && !prior.dnsProductId) data.dnsProductId = product.id;
          if (!isShowgames && !prior.dnsProductCode && product.code) data.dnsProductCode = product.code;
          if (Object.keys(data).length) updateEditions.push({ id: prior.id, data });
        } else {
          const identity=product.catalogueIdentity??product;
          const description = [product.contentType === 'addon' ? 'Дополнение к игре.' : '', product.editionType === 'цифровое издание' ? 'Цифровое издание.' : '', product.ageRating ? `Возрастное ограничение: ${product.ageRating}.` : '', product.voiceLanguages?.length ? `Озвучка: ${product.voiceLanguages.join(', ')}.` : ''].filter(Boolean).join(' ');
          createEditions.push({ id, gameId, name: identity.name === 'стандартное издание' ? 'Standard' : identity.name,
            platform: platform.name, region: identity.region || 'Не указан', lang: identity.interfaceLanguages?.join(', ') || 'Не указан', media: product.editionType === 'цифровое издание' ? 'Цифровое издание' : 'Не указан',
            releaseDate: product.releaseDate ? new Date(product.releaseDate + 'T00:00:00.000Z') : null,
            description, contents: [], coverImages: covers, barcode: '', dnsProductId: isShowgames?'':product.id, dnsProductCode: isShowgames?'':product.code ?? '' });
        }
      }
    }
  }
  // Refresh canonical galleries too when an already grouped supplier gains art.
  const updates=new Map(updateEditions.map(u=>[u.id,u.data]));
  const planned=[...editions.map(e=>({...e,...(updates.get(e.id)??{})})),...createEditions];
  for(const canonical of planned.filter(e=>!e.canonicalId)){
    const variants=planned.filter(e=>e.canonicalId===canonical.id);
    if(!variants.length)continue;
    const combined=prioritizeImages([...canonical.coverImages,...variants.flatMap(e=>e.coverImages)]);
    if(!same(canonical.coverImages,combined)){
      canonical.coverImages=combined;
      const update=updateEditions.find(u=>u.id===canonical.id);
      if(update)update.data.coverImages=combined;
      else updateEditions.push({id:canonical.id,data:{coverImages:combined}});
    }
  }
  const dedup=planEditionDedup(planned);
  const plan = { createGames, updateGames, createEditions, updateEditions, mappings, dedup };
  const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { ...plan, hash, summary: { sourceGames: document.games.length, matchedGames: mappings.filter(m=>m.matched).length,
    createGames: createGames.length, updateGameCovers: updateGames.length, createEditions: createEditions.length, updateEditions: updateEditions.length,
    beforeGames: games.length, afterGames: games.length + createGames.length, beforeEditions: editions.length, afterEditions: editions.length + createEditions.length,
    sourceProducts: new Set(document.games.flatMap(g=>g.productIds)).size,
    duplicateGroups:dedup.length,mergeVariants:dedup.reduce((n,g)=>n+g.variantIds.length,0),
    afterActiveEditions:editions.filter(e=>!e.canonicalId).length+createEditions.length-dedup.reduce((n,g)=>n+g.variantIds.filter(id=>!editions.find(e=>e.id===id)?.canonicalId).length,0) } };
}
module.exports = { titleKey, coverImages, planCatalog };
