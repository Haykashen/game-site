import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, errorMessage } from '../src/api/client.ts';
test('network failures and browser timeouts have readable messages', () => {
  assert.equal(errorMessage(new DOMException('signal timed out', 'TimeoutError')), 'Сервер не ответил вовремя. Повторите загрузку.');
  assert.equal(errorMessage(new Error('signal timed out')), 'Сервер не ответил вовремя. Повторите загрузку.');
  assert.equal(errorMessage(new TypeError('Failed to fetch')), 'Не удалось связаться с сервером. Проверьте соединение и повторите загрузку.');
  assert.equal(errorMessage(new ApiError(400, 'VALIDATION_ERROR', 'Проверьте название')), 'Проверьте название');
});
