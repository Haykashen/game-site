import { useMemo } from 'react';
import { useCollection } from '../context/CollectionContext';
import { CATALOG_FILTER_FIELDS, MARKET_FILTER_FIELDS } from '../lib/searchFilterConfig';

/** Release filters reflect actual editions from the database, including new platforms. */
export function useSearchFields(kind: 'catalog' | 'market') {
  const { editions } = useCollection();
  return useMemo(() => (kind === 'catalog' ? CATALOG_FILTER_FIELDS : MARKET_FILTER_FIELDS).map((field) => {
    const key = field.key;
    if (key !== 'platform' && key !== 'region' && key !== 'lang' && key !== 'edition') return field;
    const values = editions.map((edition) => key === 'edition' ? edition.name : edition[key]);
    return { ...field, options: [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })) };
  }), [editions, kind]);
}
