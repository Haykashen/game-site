import {z} from 'zod';
import {idSchema} from './common.js';
export const shareCopySchema = z.object({copyId: idSchema, caption: z.string().trim().max(1000).default('')});
export interface CopyShareDto {
  id: string; caption: string; photos: string[]; condition: string; completeness: string; region: string; createdAt: string;
  author: {id: string; displayName: string};
  game: {id: string; title: string};
  edition: {id: string; name: string; platform: string};
}
