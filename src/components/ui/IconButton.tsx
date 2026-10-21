import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name — these buttons are icon-only. */
  label: string;
  transparent?: boolean;
  children: ReactNode;
}

/** Round icon-only button used in the navbar and the modal header. */
export function IconButton({
  label,
  transparent = false,
  className,
  children,
  style,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      className={cx('btn-icon', className)}
      style={transparent ? { ...style, background: 'transparent' } : style}
    >
      {children}
    </button>
  );
}
