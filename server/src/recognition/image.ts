import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { badRequest } from '../errors.js';
const MAX = 5 * 1024 * 1024;
export function publicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a,b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a! >= 224 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b! >= 64 && b! <= 127) || (a === 198 && (b === 18 || b === 19)));
}
export async function recognitionImage(source: string): Promise<{mime: string; data: string}> {
  let buffer: Buffer;
  if (source.startsWith('data:')) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(source);
    if (!match || match[2]!.length > MAX * 1.4) throw badRequest('Выберите JPEG, PNG или WebP до 5 МБ.');
    buffer = Buffer.from(match[2]!, 'base64');
  } else {
    if (source.length > 2048) throw badRequest('Ссылка слишком длинная.');
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw badRequest('Нужна публичная HTTPS-ссылка на изображение.');
    const addresses = await lookup(url.hostname, {all: true, family: 4});
    if (!addresses.length || addresses.some(item => item.family !== 4 || !publicIPv4(item.address))) throw badRequest('Адрес изображения недоступен для распознавания.');
    buffer = await new Promise<Buffer>((resolve, reject) => {
      const req = request(url, {family: 4, lookup: (_hostname, _options, callback) => callback(null, addresses[0]!.address, 4)}, res => {
        if (res.statusCode !== 200) {res.resume(); reject(badRequest('Не удалось скачать изображение. Укажите прямую ссылку без перенаправлений.')); return;}
        const chunks: Buffer[] = []; let size = 0;
        res.on('data', (chunk: Buffer) => {size += chunk.length; if (size > MAX) req.destroy(badRequest('Изображение больше 5 МБ.')); else chunks.push(chunk);});
        res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', reject);
      });
      const timer = setTimeout(() => req.destroy(badRequest('Истекло время загрузки изображения.')), 12000);
      req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
    });
  }
  if (!buffer.length || buffer.length > MAX) throw badRequest('Недопустимый размер изображения.');
  const mime = buffer.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'image/jpeg' : buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : null;
  if (!mime) throw badRequest('Файл не является JPEG, PNG или WebP.');
  return {mime, data: buffer.toString('base64')};
}