const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let load;
try { ({ load } = require('cheerio')); }
catch { ({ load } = require('../.deploy/tools/node_modules/cheerio')); }

const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const key = value => clean(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’‘`']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const absolute = value => { try { const url = new URL(value, 'https://www.dns-shop.ru'); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; } };
const split = value => clean(value).split(/\s*,\s*/).filter(Boolean);
const date = value => {
  const match = value?.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
};
const trimSeparator = value => clean(value).replace(/[\s:;.\-–—]+$/u, '').trim();

// Only spelling/localisation equivalents. Sequels, remakes and collections retain
// their identity. No fuzzy matching that can silently merge different games.
const aliases = new Map(Object.entries({
  'Призрак Цусимы': 'Ghost of Tsushima',
  'Метро: Исход': 'Metro Exodus',
  'Путешествие': 'Journey',
  'Мстители Marvel': "Marvel's Avengers",
  'MARVEL Человек-Паук: Майлз Моралес': "Marvel's Spider-Man: Miles Morales",
  'Elder Scrolls V: Skyrim': 'The Elder Scrolls V: Skyrim',
}).map(([from, to]) => [key(from), to]));
const editionPattern = /(?:[\s:;.\-–—]+)((?:Game\s+of\s+the\s+Year|Complete\s+Deluxe|Special\s+Day[ -]?1|Day[ -]?(?:One|1)|Collector['’]?s|Collectors|Digital\s+Deluxe|Ultimate\s+Evil|30th\s+Anniversary|25th\s+Anniversary|Anniversary|Standard|Complete|Deluxe|Ultimate|Premium|Gold|Definitive|Special|Limited|Legendary|Launch|Legacy|Lenticular|Pioneer|Wolf\s+Pack|Pharmacorps|Troy|Guernian|Immortal|Miskatonic|Steelbook|Elena['’]s|Brutal|Hotshot|Age\s+of\s+Omus|Flow|Adrift|Midnight|Voidfarer|Cosmic|Enhanced|GOTY|Royal|Champion|Champions|Super\s+Deluxe|Super\s+Citizen|Cross[ -]Gen|Double\s+Deluxe|Specialist|Guerilla|Vengeance|Signature|Day\s+Zero|D1|First|Anniversary\s+Celebration)\s+Edition(?:\s+Double\s+Pack)?|Director['’]?s\s+Cut|PlayStation\s+Hits|Essentials|Starter\s+Collection|Королевское\s+коллекционное\s+издание|Специальное\s+издание\s+«Аврора»|Специальное\s+издание\s+Двух\s+Миров|Величайшее\s+издание\s+Земли|Коллекционное\s+издание)$/iu;
const extraEditionNames = [
  'Seekers Edition', 'Years 1-2 Fighter Edition', 'From the Ashes Edition',
  'Phantom Edition', 'Uitimate Edition', 'Mirror Edition', 'Icebreaker Edition',
  'Guardian Edition', 'Console Edition', 'Survival Bundle', 'Nomad Edition',
  'Kobe Bryant Edition', 'Meow Edition', 'Highway Edition', 'Daima Edition',
  'Calamity Edition', 'Elite Edition', 'Zeno Edition', 'Titans Edition',
  'Magitek Edition', 'Rescue Edition', 'Full Force Edition', 'Gator of the Year Edition',
  "Infect'ed Edition", 'Fully Loaded Edition', 'Ragnarok Edition',
  'Game of the YoRHa Edition', 'Yara Edition', 'Exclusive Edition',
  'PlayStation 4 Edition', 'Next-Level Edition', 'New Gen Edition', 'Old Gen Edition',
  'Freeride Edition', "Kollector's Edition", 'Smurftastic Edition',
  'Resistance Edition', 'Wild Run Edition', 'Challenge Accepted Edition',
  'Washington D.C. Edition', 'Aurora Edition', 'Origins Edition',
  'Superbloom Edition', 'Reverie Edition',
].sort((a,b) => b.length-a.length);

function parseName(title) {
  const platforms = [...new Set([...title.matchAll(/\b(?:PS[1-5]|PSP|PS\s*Vita|Xbox\s+(?:Series\s+[XS](?:\s*\|\s*[XS])?|One|360)|Nintendo\s+Switch(?:\s*2)?|PC)\b/gi)].map(m => /^ps[1-5]$/i.test(m[0]) ? m[0].toUpperCase() : clean(m[0])))];
  let name = clean(title.replace(/\[[^\]]*\]/g, '').replace(/^Игра\s+(?:для\s+(?:PS[1-5]|PSP)\s*)?/iu, ''));
  name = clean(name.replace(/\(([^()]*)\)/g, (whole, inner) => /\bPS[1-5]\b|^\d+\+$|только для VR|^(?:Экш[еэ]н|Шутер|Файтинг|Приключение|Ролевая игра|Прочее)$/i.test(inner) ? '' : whole));
  // Old DNS titles enclose the game (sometimes including its edition) in quotes.
  if (name.startsWith('"')) name = clean(name.replace(/^"([^"]+)"\s*/, '$1 '));
  name = clean(name.replace(/\s+русские субтитры$/iu, '').replace(/\bPSVR2\b/gi, ''));
  name = name.replace(/Day\s*-\s*1\s+Edition/gi, 'Day-1 Edition');
  const tags = [];
  for (let i = 0; i < 4; i++) {
    const extra = extraEditionNames.find(edition => name.toLowerCase().replace(/[’‘]/g, "'").endsWith(' ' + edition.toLowerCase()));
    if (extra) {
      tags.unshift(name.slice(-extra.length));
      name = trimSeparator(name.slice(0, -extra.length));
      continue;
    }
    const match = name.match(editionPattern);
    if (!match) break;
    tags.unshift(clean(match[1]).replace(/[’‘]/g, "'"));
    name = trimSeparator(name.slice(0, match.index));
  }
  if (/^Mortal Kombat 11\s*:?\s*Ultimate$/iu.test(name)) {
    tags.unshift('Ultimate'); name = 'Mortal Kombat 11';
  }
  const canonical = aliases.get(key(name)) ?? name;
  return { gameTitle: canonical, parsedGameTitle: name, platforms, editionTags: tags,
    editionName: tags.length ? tags.join(' / ') : null };
}

function extractImages($, card) {
  const variants = new Map();
  card.find('picture').each((_, picture) => {
    $(picture).find('source, img').each((_, image) => {
      const element = $(image);
      for (const attribute of ['src', 'data-src', 'srcset', 'data-srcset']) {
        const raw = element.attr(attribute);
        if (!raw) continue;
        for (const part of attribute.endsWith('srcset') ? raw.split(',') : [raw]) {
          const [candidate, descriptor] = clean(part).split(/\s+/);
          const url = absolute(candidate);
          if (!url) continue;
          const size = url.match(/\/(?:fit|crop|resize)\/(\d+)\/(\d+)\//);
          const current = variants.get(url) ?? { url, width: size ? +size[1] : null, height: size ? +size[2] : null,
            mimeType: element.attr('type') ?? (/\.webp(?:\?|$)/i.test(url) ? 'image/webp' : /\.png(?:\?|$)/i.test(url) ? 'image/png' : /\.jpe?g(?:\?|$)/i.test(url) ? 'image/jpeg' : null), media: [], descriptors: [], attributes: [] };
          for (const [field, value] of [['media', element.attr('media')], ['descriptors', descriptor], ['attributes', attribute]]) {
            if (value && !current[field].includes(value)) current[field].push(value);
          }
          variants.set(url, current);
        }
      }
    });
  });
  return [...variants.values()].sort((a,b) => (b.width ?? 0) - (a.width ?? 0));
}

function extract(html, sourceFile) {
  const $ = load(html);
  const products = new Map();
  const warnings = [];
  const cards = $('.catalog-product[data-product]');
  cards.each((index, node) => {
    const card = $(node), link = card.find('a.catalog-product__name').first();
    const id = card.attr('data-product');
    const sourceTitle = clean(link.attr('title'));
    if (!id || !sourceTitle) throw Error('Missing data-product or title in card ' + index);
    const title = clean(sourceTitle.replace(/\[[^\]]*\]/g, ''));
    const parsed = parseName(sourceTitle);
    const specifications = {};
    card.find('.catalog-product__spec').each((_, spec) => {
      const label = clean($(spec).find('.catalog-product__spec-label').text()).replace(/:$/, '');
      const value = $(spec).find('.catalog-product__spec-value').first();
      if (label) specifications[label] = clean(value.attr('title') ?? value.text());
    });
    const editionType = sourceTitle.match(/(?:стандартное|расширенное|коллекционное|специальное|ограниченное)\s+издание/iu)?.[0] ?? null;
    const imageVariants = extractImages($, card);
    const priceText = clean(card.find('.product-buy__price').first().text());
    const priceMatch = priceText.match(/([\d\s]+)(?:[.,](\d{1,2}))?\s*₽/u);
    const ratingText = clean(card.find('.catalog-product__rating').first().text());
    const ratingValue = clean(card.find('.catalog-product__rating b').first().text());
    const commentsText = clean(card.find('.catalog-product__comment').first().text());
    const releaseDateText = specifications['Дата выхода'] || sourceTitle.match(/дата выхода:\s*([^,\]]+)/iu)?.[1] || null;
    const images = imageVariants.map(v => v.url);
    const product = {
      id, code: card.attr('data-code') ?? null, title, sourceTitle,
      gameTitle: parsed.gameTitle, parsedGameTitle: parsed.parsedGameTitle, platforms: parsed.platforms,
      editionName: parsed.editionName ?? (editionType ?? 'Не указано'), editionTags: parsed.editionTags,
      editionType, editionNameSource: parsed.editionName ? 'title' : editionType ? 'title-specifications' : 'unspecified',
      productUrl: absolute(link.attr('href')), releaseDate: date(releaseDateText), releaseDateText,
      ageRating: specifications['Возрастное ограничение'] || sourceTitle.match(/\b\d{1,2}\+/)?.[0] || null,
      genres: split(specifications['Жанр']), interfaceLanguages: split(specifications['Язык интерфейса и субтитров']),
      voiceLanguages: split(specifications['Язык озвучки']), specifications,
      price: priceMatch ? Number(priceMatch[1].replace(/\s/g, '') + '.' + (priceMatch[2] ?? '0')) : null,
      currency: priceMatch ? 'RUB' : null, priceText: priceText || null,
      rating: ratingValue && Number.isFinite(Number(ratingValue.replace(',', '.'))) ? Number(ratingValue.replace(',', '.')) : null,
      ratingScale: ratingValue ? 5 : null,
      reviewCount: ratingText.match(/(?:\||\s)([\d\s]+)\s*отзыв/iu) ? Number(ratingText.match(/(?:\||\s)([\d\s]+)\s*отзыв/iu)[1].replace(/\s/g, '')) : null,
      ratingText: ratingText || null,
      questionCount: /^\d+$/.test(commentsText) ? +commentsText : null,
      reliability: clean(card.find('.catalog-product__service-rating').first().text()) || null,
      availability: { code: card.attr('data-avail-status') ?? null,
        text: clean(card.find('.available, .catalog-product__not-available').first().text()) || null },
      advertisedImageCount: Number(card.find('.catalog-product__image-link').attr('data-count')) || null,
      image: images[0] ?? null, images, imageVariants,
      sourceCardIndex: index + 1,
    };
    // DNS's Gold Edition drops "Remake" from the product title. Keep it out
    // of the original RE4 group; preserve the raw title and DNS date verbatim.
    if (key(product.gameTitle) === 'resident evil 4' && parsed.editionTags.some(tag => /^Gold Edition$/i.test(tag))) {
      product.gameTitle = 'Resident Evil 4 Remake';
      product.groupingAnnotation = { reason: 'Gold Edition относится к ремейку, а не к оригинальной игре.', source: 'https://www.capcom.co.jp/ir/english/news/pdf/e240313.pdf' };
    }
    if (!parsed.platforms.length) warnings.push({ id, issue: 'platform-not-found', title: sourceTitle });
    if (!images.length) warnings.push({ id, issue: 'no-picture-images', title: sourceTitle });
    if (/\bEdition\b/iu.test(parsed.gameTitle) && !/(?:Classic Edition|Warmastered Edition|Deathenitive Edition|Remastered Edition|Complete Edition Remastered)$/iu.test(parsed.gameTitle)) warnings.push({ id, issue: 'unrecognised-edition-name', title: sourceTitle });
    if (products.has(id)) {
      // Do not silently discard conflicting copies of the same product.
      const existing = products.get(id);
      if (existing.sourceTitle !== sourceTitle) throw Error('Conflicting duplicate product: ' + id);
      for (const variant of imageVariants) if (!existing.images.includes(variant.url)) {
        existing.images.push(variant.url); existing.imageVariants.push(variant);
      }
    } else products.set(id, product);
  });
  const groups = new Map();
  for (const product of products.values()) {
    const gameKey = key(product.gameTitle);
    const game = groups.get(gameKey) ?? { id: product.id, title: product.gameTitle, productIds: [], sourceGameTitles: [], genres: [], platforms: [] };
    game.productIds.push(product.id);
    if (!game.sourceGameTitles.includes(product.parsedGameTitle)) game.sourceGameTitles.push(product.parsedGameTitle);
    for (const genre of product.genres) if (!game.genres.includes(genre)) game.genres.push(genre);
    for (const name of product.platforms.length ? product.platforms : ['Не определена']) {
      let platform = game.platforms.find(p => p.name === name);
      if (!platform) { platform = { name, editions: [] }; game.platforms.push(platform); }
      const { gameTitle, parsedGameTitle, editionName, ...details } = product;
      platform.editions.push({ ...details, name: editionName });
    }
    groups.set(gameKey, game);
  }
  const games = [...groups.values()];
  return { schemaVersion: 1, source: { file: path.basename(sourceFile), sha256: crypto.createHash('sha256').update(html).digest('hex'), baseUrl: 'https://www.dns-shop.ru', extractedAt: new Date().toISOString() },
    conventions: { gameId: 'data-product первого товара группы; все товарные ID перечислены в productIds', editionId: 'data-product конкретного товара, без изменений',
      grouping: 'Нормализация регистра, пунктуации, апострофов и диакритики; явные названия изданий отделены от названия игры. Ремейки, ремастеры и сборники остаются отдельными названиями.',
      multiPlatform: 'Товар с несколькими платформами присутствует у каждой; одинаковый id означает один и тот же товар, не дубликат источника.',
      releaseDate: 'Дата конкретного товара из HTML, не год первого выпуска игры.',
      images: 'Только фактические URL из source/img внутри picture. Размеры — из URL thumbnail. Разные размеры/форматы сохранены; точные дубликаты URL удалены.',
      missing: 'null / пустой массив / «Не указано» означают отсутствие данных. Цены, рейтинги и наличие — снимок HTML, не актуальные значения.' },
    stats: { sourceCards: cards.length, uniqueProducts: products.size, games: games.length, platformGroups: games.reduce((n,g) => n + g.platforms.length, 0), editionEntries: games.reduce((n,g) => n + g.platforms.reduce((m,p) => m + p.editions.length, 0), 0), productsWithImages: [...products.values()].filter(p => p.images.length).length, productsWithReleaseDate: [...products.values()].filter(p => p.releaseDate).length, multiPlatformProducts: [...products.values()].filter(p => p.platforms.length > 1).length },
    games, warnings };
}

module.exports = { extract, parseName };
if (require.main === module) {
  const input = process.argv[2], output = process.argv[3] ?? 'exports/games-dns.json';
  if (!input) throw Error('Usage: node scripts/extract-dns-catalog.cjs input.html [output.json]');
  const result = extract(fs.readFileSync(input, 'utf8'), input);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result.stats, warnings: result.warnings.length, output: path.resolve(output) }, null, 2));
}
