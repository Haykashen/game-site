import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';
import { badRequest } from '../errors.js';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const MAX_DECODED_PHOTO_BYTES = 5 * 1024 * 1024;

let client: S3Client | null = null;
let ready: Promise<void> | null = null;
let s3Usable = env.s3.enabled;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.s3.endpoint,
      region: env.s3.region,
      forcePathStyle: env.s3.forcePathStyle,
      credentials: {
        accessKeyId: env.s3.accessKey,
        secretAccessKey: env.s3.secretKey,
      },
    });
  }

  return client;
}

export async function ensureStorageReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!env.s3.enabled) {
        await fs.mkdir(env.uploadDir, { recursive: true });
        return;
      }

      const s3 = getClient();

      try {
        await s3.send(new HeadBucketCommand({ Bucket: env.s3.bucket }));
      } catch {
        try {
          await s3.send(new CreateBucketCommand({ Bucket: env.s3.bucket }));
        } catch (error) {
          // A competing process may have created the bucket between the two calls.
          // If MinIO/S3 is simply unavailable, local disk keeps the demo usable.
          console.warn(
            'S3/MinIO is unavailable; uploads will be stored in the local uploads directory.',
            error,
          );
          s3Usable = false;
        }
      }

      if (!s3Usable) {
        await fs.mkdir(env.uploadDir, { recursive: true });
      }
    })().catch(async (error) => {
      console.warn('Object storage initialization failed; using local disk.', error);
      s3Usable = false;
      await fs.mkdir(env.uploadDir, { recursive: true });
    });
  }

  return ready;
}

function extensionFor(mime: string): string {
  const extension = MIME_EXTENSIONS[mime.toLowerCase()];
  if (!extension) throw badRequest('Поддерживаются только JPEG, PNG, WebP, GIF и AVIF.');
  return extension;
}

function s3PublicUrl(key: string): string {
  if (env.s3.publicUrl) return `${env.s3.publicUrl}/${key}`;
  return `${env.s3.endpoint.replace(/\/+$/, '')}/${env.s3.bucket}/${key}`;
}

async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await ensureStorageReady();

  if (!s3Usable) {
    const fileName = path.basename(key);
    await fs.writeFile(path.join(env.uploadDir, fileName), body);
    return `${env.publicApiUrl}/uploads/${fileName}`;
  }

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return s3PublicUrl(key);
  } catch (error) {
    // MinIO/S3 may go down after a successful startup check. Keep uploads
    // usable by falling back to the local directory for the rest of the run.
    console.warn('S3 upload failed; storing the photo locally.', error);
    s3Usable = false;

    const fileName = path.basename(key);
    await fs.writeFile(path.join(env.uploadDir, fileName), body);
    return `${env.publicApiUrl}/uploads/${fileName}`;
  }
}

export async function storeUpload(buffer: Buffer, mime: string): Promise<string> {
  if (buffer.byteLength === 0) throw badRequest('Файл пуст.');
  if (buffer.byteLength > env.maxUploadBytes) {
    throw badRequest('Файл слишком большой.');
  }

  const extension = extensionFor(mime);
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  return putObject(key, buffer, mime);
}

/**
 * Accepts already-hosted URLs and browser data URLs. Data URLs are written to
 * S3/MinIO or the local upload directory, so PostgreSQL stores compact URLs.
 */
export async function storePhotoReference(
  value: string,
  prefix = 'market',
): Promise<string> {
  if (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')) {
    return value;
  }

  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif|avif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    value,
  );

  if (!match) {
    throw badRequest('Фото должно быть ссылкой или data-URL изображения.');
  }

  const mime = (match[1] ?? '').toLowerCase();
  const encoded = (match[2] ?? '').replace(/\s/g, '');
  const buffer = Buffer.from(encoded, 'base64');

  if (buffer.byteLength === 0) throw badRequest('Не удалось прочитать изображение.');
  if (buffer.byteLength > Math.min(env.maxUploadBytes, MAX_DECODED_PHOTO_BYTES)) {
    throw badRequest('Изображение слишком большое.');
  }

  const extension = extensionFor(mime);
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  return putObject(key, buffer, mime);
}

export async function storePhotoReferences(
  values: readonly string[],
  prefix = 'market',
): Promise<string[]> {
  return Promise.all(values.map((value) => storePhotoReference(value, prefix)));
}
