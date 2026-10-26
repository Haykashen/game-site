import type { PrismaClient } from '@prisma/client';
import { notFound } from '../errors.js';

/** Old SKU-based links continue resolving after logical editions are grouped. */
export async function resolveEditionId(prisma: PrismaClient, id: string): Promise<string> {
  const edition = await prisma.edition.findUnique({where: {id}, select: {id:true,canonicalId:true}});
  if (!edition) throw notFound('Издание не найдено.');
  return edition.canonicalId ?? edition.id;
}
