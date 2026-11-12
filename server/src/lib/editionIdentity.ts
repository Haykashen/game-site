import type { PrismaClient } from '@prisma/client';
import { notFound } from '../errors.js';

/** Validate that a referenced edition exists. */
export async function resolveEditionId(prisma: PrismaClient, id: string): Promise<string> {
  const edition = await prisma.edition.findUnique({where: {id}, select: {id:true}});
  if (!edition) throw notFound('Издание не найдено.');
  return edition.id;
}
