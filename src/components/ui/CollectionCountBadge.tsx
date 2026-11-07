import { Library } from 'lucide-react';

export function CollectionCountBadge({count}: {count: number}) {
  if (count <= 0) return null;
  const label = `В коллекции: ${count} экз.`;
  return <span className="badge-owned" title={label} aria-label={label}>
    <Library size={16} aria-hidden="true" /><span>× {count}</span>
  </span>;
}
