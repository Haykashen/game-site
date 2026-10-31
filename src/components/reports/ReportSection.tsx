import { Flag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReportTargetType } from '@discvault/shared';
import { useAuth } from '../../context/AuthContext';
import { ReportForm } from './ReportForm';

interface ReportSectionProps {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  /** Hide the control for the current user's own lot or profile. */
  disabled?: boolean;
  compact?: boolean;
  showLabel?: boolean;
}

/** Collapsible report entry point; reports require an authenticated session. */
export function ReportSection({
  targetType,
  targetId,
  targetLabel,
  disabled = false,
  compact = false,
  showLabel = false,
}: ReportSectionProps) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (disabled) return null;

  return (
    <section className={compact ? 'report-section report-section--compact' : 'report-section'} aria-label="Пожаловаться">
      {isAuthenticated ? (
        <button
          type="button"
          className="report-section__trigger"
          aria-expanded={isOpen}
          aria-label="Пожаловаться"
          title="Пожаловаться"
          onClick={() => setIsOpen((value) => !value)}
        >
          <Flag size={14} aria-hidden="true" />
          {showLabel ? 'Пожаловаться' : !compact && (isOpen ? 'Скрыть форму жалобы' : 'Пожаловаться')}
        </button>
      ) : (
        compact ? <Link className="report-section__trigger" to="/account" aria-label="Войти, чтобы пожаловаться" title="Войти, чтобы пожаловаться"><Flag size={16}/>{showLabel && 'Пожаловаться'}</Link> : <p className="report-section__guest">
          <Flag size={14} aria-hidden="true" />
          <span>
            Заметили нарушение?{' '}
            <Link to="/account">Войдите</Link>, чтобы отправить жалобу.
          </span>
        </p>
      )}

      {isAuthenticated && isOpen && (
        <ReportForm
          targetType={targetType}
          targetId={targetId}
          targetLabel={targetLabel}
          onCancel={() => setIsOpen(false)}
        />
      )}
    </section>
  );
}
