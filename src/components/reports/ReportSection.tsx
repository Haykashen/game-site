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
}

/** Collapsible report entry point; reports require an authenticated session. */
export function ReportSection({
  targetType,
  targetId,
  targetLabel,
  disabled = false,
}: ReportSectionProps) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (disabled) return null;

  return (
    <section className="report-section" aria-label="Пожаловаться">
      {isAuthenticated ? (
        <button
          type="button"
          className="report-section__trigger"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <Flag size={14} aria-hidden="true" />
          {isOpen ? 'Скрыть форму жалобы' : 'Пожаловаться'}
        </button>
      ) : (
        <p className="report-section__guest">
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
