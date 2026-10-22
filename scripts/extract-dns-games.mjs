import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inputPath = process.argv[2] ?? 'C:/Users/User/Desktop/dns-games.html';
const outputPath = process.argv[3] ?? 'dns-ps-games.json';

const html = readFileSync(resolve(inputPath), 'utf8');

const decodeEntities = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const stripTags = (value) =>
  decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

const absoluteUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return new URL(value, 'https://www.dns-shop.ru').href;
};

const imageSize = (url) => {
  const match = url.match(/\/fit\/(\d+)\/(\d+)\//);
  return match ? Math.max(Number(match[1]), Number(match[2])) : 0;
};

const extractSrcsetUrls = (value) =>
  value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);

const toIsoDate = (value) => {
  const match = value?.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const extractImages = (block) => {
  const urls = new Set();

  for (const picture of block.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gi)) {
    const inner = picture[1];
    for (const attr of ['src', 'data-src', 'srcset', 'data-srcset']) {
      for (const match of inner.matchAll(new RegExp(`\\b${attr}="([^"]*)"`, 'gi'))) {
        const raw = decodeEntities(match[1]);
        const candidates = attr.endsWith('srcset') ? extractSrcsetUrls(raw) : [raw];
        for (const candidate of candidates) {
          const url = absoluteUrl(candidate);
          if (url) urls.add(url);
        }
      }
    }
  }

  return [...urls].sort((a, b) => imageSize(b) - imageSize(a));
};

const productStart = /<div\b[^>]*\bdata-product="([^"]+)"[^>]*>/gi;
const starts = [...html.matchAll(productStart)].map((match) => ({
  id: match[1],
  start: match.index,
  tag: match[0],
}));

const products = [];
const seen = new Set();

for (let index = 0; index < starts.length; index += 1) {
  const item = starts[index];
  if (seen.has(item.id)) continue;
  seen.add(item.id);

  const end = index + 1 < starts.length ? starts[index + 1].start : html.length;
  const block = html.slice(item.start, end);

  const images = extractImages(block);
  const code = item.tag.match(/\bdata-code="([^"]*)"/i)?.[1] ?? null;
  const availability = item.tag.match(/\bdata-avail-status="([^"]*)"/i)?.[1] ?? null;
  const productHref =
    block.match(/class="catalog-product__image-link"[^>]*\bhref="([^"]+)"/i)?.[1] ??
    block.match(/class="catalog-product__name[^"]*"[^>]*\bhref="([^"]+)"/i)?.[1] ??
    null;
  const alt = block.match(/<img\b[^>]*\balt="([^"]*)"/i)?.[1] ?? null;
  const nameTitle = block.match(/class="catalog-product__name[^"]*"[^>]*\btitle="([^"]*)"/i)?.[1] ?? null;
  const nameText = block.match(/class="catalog-product__name[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? null;

  const title = stripTags(alt ?? nameTitle ?? nameText ?? '') || null;
  const platformMatch = `${title ?? ''} ${productHref ?? ''}`.match(/\b(PS[345])\b/i);
  const platform = platformMatch ? platformMatch[1].toUpperCase() : null;
  const releaseDateText =
    block.match(/Дата выхода:\s*<\/div>\s*<div[^>]*\btitle="([^"]*)"/i)?.[1]?.trim() ??
    block.match(/дата выхода:\s*([^,\]]+)/i)?.[1]?.trim() ??
    null;
  const releaseDate = toIsoDate(releaseDateText);

  products.push({
    id: item.id,
    title,
    platform,
    releaseDate,
    releaseDateText,
    productUrl: absoluteUrl(productHref),
    image: images[0] ?? null,
    images,
    code,
    availability,
  });
}

writeFileSync(resolve(outputPath), `${JSON.stringify(products, null, 2)}\n`, 'utf8');

const missingImages = products.filter((product) => !product.image).length;
const missingTitles = products.filter((product) => !product.title).length;
const missingDates = products.filter((product) => !product.releaseDate).length;
const platforms = products.reduce((counts, product) => {
  const key = product.platform ?? 'unknown';
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

console.log(`Cards found: ${starts.length}`);
console.log(`Unique products: ${products.length}`);
console.log(`Missing images: ${missingImages}`);
console.log(`Missing titles: ${missingTitles}`);
console.log(`Missing release dates: ${missingDates}`);
console.log('Platforms:', platforms);
console.log(`Written: ${resolve(outputPath)}`);
