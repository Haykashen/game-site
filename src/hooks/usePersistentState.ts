import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readStorage, writeStorage } from '../lib/storage';

/**
 * State mirrored to localStorage. Reads lazily (one time) and writes on change.
 * A custom `parse` keeps malformed or legacy payloads from crashing the app.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  parse?: (value: unknown) => T | null,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback, parse));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
