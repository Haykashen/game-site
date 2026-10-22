export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Требуется авторизация.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Недостаточно прав.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Запись не найдена.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
