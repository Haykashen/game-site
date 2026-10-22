import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { photoReferenceSchema } from '@retrokeep/shared';
import { badRequest, unauthorized } from '../errors.js';
import { storePhotoReference, storeUpload } from '../lib/storage.js';
import { parse } from '../lib/validation.js';

const dataUrlSchema = z.object({
  dataUrl: photoReferenceSchema,
});

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/uploads',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const file = await request.file();

      if (!file) throw badRequest('Файл не передан.');

      if (!file.mimetype.startsWith('image/')) {
        throw badRequest('Можно загружать только изображения.');
      }

      const buffer = await file.toBuffer();
      const url = await storeUpload(buffer, file.mimetype);

      return reply.code(201).send({ url });
    },
  );

  app.post(
    '/api/v1/uploads/data-url',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const input = parse(dataUrlSchema, request.body);
      const url = await storePhotoReference(input.dataUrl, 'uploads');

      return reply.code(201).send({ url });
    },
  );
}
