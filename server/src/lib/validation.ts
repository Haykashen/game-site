import type { z } from 'zod';
import { AppError } from '../errors.js';

export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Проверьте введённые данные.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return result.data;
}
