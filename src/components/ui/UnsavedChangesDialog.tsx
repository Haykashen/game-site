import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
interface Props {busy: boolean; onSave: () => void; onDiscard: () => void; onContinue: () => void}
export function UnsavedChangesDialog({busy, onSave, onDiscard, onContinue}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement; const dialog = ref.current;
    dialog?.showModal();
    return () => {dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus();};
  }, []);
  return createPortal(<dialog ref={ref} className="unsaved-dialog" aria-labelledby="unsaved-title" aria-describedby="unsaved-description"
    onKeyDown={event => {if (event.key === 'Escape') event.stopPropagation();}}
    onCancel={event => {event.preventDefault(); if (!busy) onContinue();}}>
    <h2 id="unsaved-title">Сохранить изменения?</h2><p id="unsaved-description">Вы изменили данные экземпляра. Сохранить их перед выходом из режима редактирования?</p>
    <div className="unsaved-dialog__actions"><button type="button" className="btn-secondary" autoFocus disabled={busy} onClick={onContinue}>Продолжить редактирование</button><button type="button" className="btn-secondary" disabled={busy} onClick={onDiscard}>Не сохранять</button><button type="button" className="btn-primary" disabled={busy} onClick={onSave}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </dialog>, document.body);
}
