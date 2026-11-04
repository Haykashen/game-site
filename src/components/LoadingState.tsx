import { RefreshCw } from 'lucide-react';
import { cx } from '../lib/cx';

interface LoadingStateProps {
  message?: string;
  variant?: 'panel' | 'inline';
  className?: string;
}

/** Shared data-fetch indicator for pages, drawers, tables and selectors. */
export function LoadingState({ message = 'Загружаем данные с сервера…', variant = 'panel', className }: LoadingStateProps) {
  const content = <><RefreshCw className="loading-state__icon" size={18} aria-hidden="true" /><span>{message}</span></>;
  const classes = cx('loading-state', variant === 'panel' && 'panel loading-state--panel', className);
  return variant === 'inline'
    ? <span className={classes} role="status" aria-live="polite" aria-atomic="true">{content}</span>
    : <div className={classes} role="status" aria-live="polite" aria-atomic="true">{content}</div>;
}
