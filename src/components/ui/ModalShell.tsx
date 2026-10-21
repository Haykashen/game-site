import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { cx } from '../../lib/cx';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

/**
 * Side-drawer modal plumbing: enter/exit animation, backdrop, Escape key,
 * body scroll lock and focus restoration. Visuals stay in styles.css.
 */
export function ModalShell({ isOpen, onClose, labelledBy, children }: ModalShellProps) {
  const { isMounted, isActive } = useAnimatedPresence(isOpen);
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(isOpen);
  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (!isOpen || !isMounted) return;

    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, isMounted]);

  // Keep keyboard focus inside the drawer while it is open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !isMounted || !dialog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => dialog.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isMounted]);

  if (!isMounted) return null;

  return (
    <div className={cx('modal-fixed', isActive && 'active')} style={{ display: 'block' }}>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        ref={dialogRef}
      >
        {children}
      </div>
    </div>
  );
}
