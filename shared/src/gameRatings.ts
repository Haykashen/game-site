import { z } from 'zod';

export const gameRatingParamsSchema = z.object({ id: z.string().trim().min(1).max(100) });
export const gameRatingSchema = z.object({ score: z.number().int().min(0).max(10) });

export interface GameRatingSummary {
  average: number | null;
  count: number;
  myScore: number | null;
}
