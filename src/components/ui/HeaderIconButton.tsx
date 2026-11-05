import type { ReactNode, MouseEventHandler, AriaAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';

type HeaderIconButtonProps = {
  label: string;
  title?: string;
  children: ReactNode;
  accent?: boolean;
  'aria-current'?: AriaAttributes['aria-current'];
} & ({ to: string; onClick?: never } | { to?: never; onClick: MouseEventHandler<HTMLButtonElement> });

/** Shared header action, rendered as a navigation link or an action button. */
export function HeaderIconButton({ label, title, children, accent, to, onClick, 'aria-current': current }: HeaderIconButtonProps) {
  const props = { className: cx('btn-icon header-icon-button', accent && 'header-icon-button--accent'), 'aria-label': label, title: title ?? label, 'aria-current': current };
  return to !== undefined
    ? <Link {...props} to={to}>{children}</Link>
    : <button {...props} type="button" onClick={onClick}>{children}</button>;
}