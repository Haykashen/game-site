import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UrlFilterField } from '../lib/searchFilterConfig';

export interface UrlFilters<Key extends string> {
  readonly values: Readonly<Record<Key, string>>;
  readonly setValue: (key: Key, value: string) => void;
  readonly reset: () => void;
}

/**
 * Keeps filter values in the URL without touching panel params such as
 * `item`, `compose` and `game`, so drawers and placement flows keep working.
 */
export function useUrlFilters<Key extends string>(
  fields: readonly UrlFilterField<Key>[],
): UrlFilters<Key> {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const next = {} as Record<Key, string>;

    for (const field of fields) {
      next[field.key] = searchParams.get(field.param) ?? '';
    }

    return next;
  }, [fields, searchParams]);

  const setValue = useCallback(
    (key: Key, value: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          const field = fields.find((item) => item.key === key);

          if (!field) return next;

          if (value) {
            next.set(field.param, value);
          } else {
            next.delete(field.param);
          }

          return next;
        },
        { replace: true },
      );
    },
    [fields, setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        for (const field of fields) {
          next.delete(field.param);
        }

        return next;
      },
      { replace: true },
    );
  }, [fields, setSearchParams]);

  return { values, setValue, reset };
}
