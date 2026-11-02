import { cx } from '../lib/cx';

/** Decorative initial; the adjacent author name supplies the accessible label. */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return <span className={cx('feed-avatar', className)} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}
