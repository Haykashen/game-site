import type { ApiErrorBody } from '@discvault/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorBody(value: unknown): ApiErrorBody['error'] | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;

  const error = value.error;
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    return null;
  }

  return {
    code: error.code,
    message: error.message,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Same-origin JSON request helper. Cookies carry the API session. */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body } : {}),
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? parseJson(text) : null;

  if (!response.ok) {
    const error = readErrorBody(data);
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Запрос завершился с ошибкой ${response.status}.`,
      error?.details,
    );
  }

  return data as T;
}

/** The API answers `200` only when both the process and PostgreSQL are ready. */
export async function checkApiHealth(signal?: AbortSignal): Promise<boolean> {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') {
    return false;
  }

  try {
    const response = await fetch('/api/health', {
      credentials: 'include',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    });

    if (!response.ok) return false;

    const data: unknown = await response.json();
    return (
      isRecord(data) &&
      data['status'] === 'ok' &&
      data['database'] === 'up'
    );
  } catch {
    return false;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Не удалось выполнить запрос к серверу.';
}
