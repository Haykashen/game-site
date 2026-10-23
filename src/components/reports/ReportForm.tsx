import { Send } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ReportReason, ReportTargetType } from '@retrokeep/shared';
import { createReport, errorMessage } from '../../api';
import { FormField } from '../ui/FormField';

const REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: 'fraud', label: 'Мошенничество или обман' },
  { value: 'prohibited', label: 'Запрещённый товар или услуга' },
  { value: 'offensive', label: 'Оскорбительное содержание' },
  { value: 'spam', label: 'Спам или реклама' },
  { value: 'wrong_category', label: 'Не та категория или не соответствует описанию' },
  { value: 'other', label: 'Другое' },
];

interface ReportFormProps {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  onCancel?: () => void;
}

/** Inline report form used by a lot and by a public profile. */
export function ReportForm({
  targetType,
  targetId,
  targetLabel,
  onCancel,
}: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason>('fraud');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idPrefix = `report-${targetType}-${targetId}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await createReport({
        targetType,
        targetId,
        reason,
        comment: comment.trim(),
      });
      setMessage('Жалоба отправлена. Модераторы проверят её в ближайшее время.');
      setComment('');
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="market-form report-form" onSubmit={handleSubmit}>
      <div className="report-form__head">
        <h4>Жалоба на {targetType === 'market_entry' ? 'объявление' : 'пользователя'}</h4>
        <p>{targetLabel}</p>
      </div>

      <FormField id={`${idPrefix}-reason`} label="Причина">
        <select
          id={`${idPrefix}-reason`}
          className="form-control"
          value={reason}
          onChange={(event) => setReason(event.target.value as ReportReason)}
        >
          {REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField id={`${idPrefix}-comment`} label="Комментарий (необязательно)">
        <textarea
          id={`${idPrefix}-comment`}
          className="form-control"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Что именно нарушает правила?"
        />
      </FormField>

      {error && (
        <p className="market-form__error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="report-form__success" role="status">
          {message}
        </p>
      )}

      <div className="market-form__actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Закрыть
          </button>
        )}
        <button
          type="submit"
          className="market-form__submit"
          disabled={isSubmitting || Boolean(message)}
        >
          <Send size={15} aria-hidden="true" />
          {isSubmitting ? 'Отправляем…' : 'Отправить жалобу'}
        </button>
      </div>
    </form>
  );
}
