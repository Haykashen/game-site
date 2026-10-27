import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { AdminField, AdminRecord, AdminReference, AdminTable, AdminValue } from '@discvault/shared';
import { adminOptionLabel } from '@discvault/shared';
import { ApiError, errorMessage } from '../../api/client';
import { createAdminRecord, deleteAdminRecord, fetchAdminRecord, fetchAdminReferences, updateAdminRecord } from '../../api/adminData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ModalShell } from '../ui/ModalShell';

export interface AdminEditor { mode: 'create' | 'edit' | 'delete'; key: string | null }
function toInput(field: AdminField, value: AdminValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join('\n');
  if (field.type === 'date') {
    if (field.dateOnly) return String(value).slice(0, 10);
    const date = new Date(String(value));
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
  }
  return String(value);
}
function formatError(cause: unknown): string {
  if (cause instanceof ApiError && Array.isArray(cause.details)) {
    return errorMessage(cause) + ' ' + cause.details.map((issue: unknown) => {
      if (typeof issue === 'object' && issue && 'message' in issue) return `${'path' in issue ? String(issue.path) + ': ' : ''}${String(issue.message)}`;
      return '';
    }).join(' ');
  }
  return errorMessage(cause);
}

function ReferenceInput({field, value, onChange, required, inputId}: {field: AdminField; value: string; onChange: (value: string) => void; required: boolean; inputId: string}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<AdminReference[]>([]);
  const [error, setError] = useState('');
  const query = useDebouncedValue(search);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void fetchAdminReferences(field.reference!, query, controller.signal).then((result) => {
      if (!controller.signal.aborted) setOptions(result.items);
    }).catch((cause: unknown) => {if (!controller.signal.aborted) setError(errorMessage(cause));});
    return () => controller.abort();
  }, [field.reference, query]);
  return <div className="admin-data__reference">
    <input className="form-control" aria-label={`Поиск: ${field.label}`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти связанную запись…" />
    <select id={inputId} className="form-control" aria-label={field.label} aria-describedby={id} required={required} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{required ? 'Выберите запись' : 'Не указано'}</option>
      {value && !options.some((item) => item.value === value) && <option value={value}>{value}</option>}
      {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    <small id={id}>Первые 30 совпадений. <Link to={`/admin/data/${field.reference}`}>Открыть связанную таблицу</Link></small>
    {error && <small role="alert">{error}</small>}
  </div>;
}

export function AdminRecordDialog({table, editor, onClose, onSaved, title}: {table: AdminTable; editor: AdminEditor; onClose: () => void; onSaved: (record?: AdminRecord) => void | Promise<void>; title?: string}) {
  const [record, setRecord] = useState<AdminRecord>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editor.mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(editor.mode === 'create');
  const titleId = useId();
  const deleting = editor.mode === 'delete';
  const creating = editor.mode === 'create';
  const fields = table.fields.filter((field) => !field.readOnly && (creating || !field.primary));
  useEffect(() => {
    if (!editor.key) return;
    const controller = new AbortController();
    void fetchAdminRecord(table.name, editor.key, controller.signal).then(({record: item}) => {
      if (controller.signal.aborted) return;
      setRecord(item);
      setValues(Object.fromEntries(table.fields.map((field) => [field.name, toInput(field, item[field.name])])));
      setLoaded(true);
    }).catch((cause: unknown) => {if (!controller.signal.aborted) setError(formatError(cause));}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [table, editor.key]);

  async function submit() {
    setSaving(true); setError('');
    try {
      let savedRecord: AdminRecord | undefined;
      const version = typeof record.updatedAt === 'string' ? record.updatedAt : null;
      if (deleting) await deleteAdminRecord(table.name, editor.key!, version);
      else {
        const data: AdminRecord = {};
        for (const field of fields) {
          const value = values[field.name] ?? '';
          if (!creating && value === toInput(field, record[field.name])) continue;
          if (!value && field.type === 'password' && !creating) continue;
          if (!value && creating && !field.required && field.type !== 'list') continue;
          let parsed: AdminValue;
          if (field.type === 'list') parsed = value.split('\n').map((item) => item.trim()).filter(Boolean);
          else if (!value && field.nullable) parsed = null;
          else if (field.type === 'number') {
            if (!value || !Number.isFinite(Number(value))) throw new Error(`Введите число: ${field.label}.`);
            parsed = Number(value);
          } else if (field.type === 'boolean') parsed = value === 'true';
          else if (field.type === 'date') parsed = new Date(field.dateOnly ? value + 'T00:00:00.000Z' : value).toISOString();
          else parsed = value;
          data[field.name] = parsed;
        }
        if (!Object.keys(data).length) {onClose(); return;}
        if (creating) savedRecord = (await createAdminRecord(table.name, data)).record;
        else savedRecord = (await updateAdminRecord(table.name, editor.key!, data, version)).record;
      }
      await onSaved(savedRecord);
      onClose();
    } catch (cause) {setError(formatError(cause));}
    finally {setSaving(false);}
  }

  return <ModalShell isOpen onClose={() => {if (!saving) onClose();}} labelledBy={titleId}>
    <form className="admin-data__editor" onSubmit={(event) => {event.preventDefault(); void submit();}}>
      <div className="admin-data__editor-header"><div><small>{table.label}</small><h2 id={titleId}>{title ?? (deleting ? table.name === 'Session' ? 'Отозвать сессию' : 'Удалить запись' : creating ? 'Добавить запись' : 'Редактировать запись')}</h2></div>
        <button type="button" className="btn-secondary" aria-label="Закрыть" disabled={saving} onClick={onClose}><X size={18} /></button>
      </div>
      {loading && <p role="status">Загружаем запись…</p>}
      {error && <div className="admin-data__error" role="alert">{error}</div>}
      {loaded && (deleting ? <div className="admin-data__delete-note">
        <p>{table.name === 'Session' ? 'Пользователю потребуется снова войти в аккаунт.' : 'Запись будет удалена без возможности восстановления. Если на неё ссылаются другие записи, сервер укажет связанные таблицы — сначала нужно удалить или переназначить эти записи.'}</p>
        <strong>{String(record.displayName ?? record.title ?? record.name ?? record.id ?? editor.key)}</strong>
      </div> : <div className="admin-data__fields">{fields.map((field) => {
        const value = values[field.name] ?? '';
        const required = field.required && (creating || field.type !== 'password');
        const change = (next: string) => setValues((previous) => ({...previous, [field.name]: next}));
        return <div className="admin-data__field" key={field.name}><label htmlFor={`${titleId}-${field.name}`}>{field.label}{required ? ' *' : ''}</label>
          {field.reference ? <ReferenceInput field={field} inputId={`${titleId}-${field.name}`} value={value} required={required} onChange={change} /> : field.type === 'enum' || field.type === 'boolean' ? <select id={`${titleId}-${field.name}`} className="form-control" required={required} value={value} onChange={(event) => change(event.target.value)}>
            {(creating || field.nullable) && <option value="">{creating && field.generated ? 'По умолчанию' : 'Не указано'}</option>}
            {(field.type === 'boolean' ? ['true', 'false'] : field.options).map((option) => <option key={option} value={option}>{adminOptionLabel(option)}</option>)}
          </select> : field.type === 'list' && field.options.length ? <select id={`${titleId}-${field.name}`} multiple className="form-control" value={value.split('\n')} onChange={(event) => change(Array.from(event.target.selectedOptions).map((item) => item.value).join('\n'))}>
            {field.options.map((option) => <option key={option} value={option}>{adminOptionLabel(option)}</option>)}
          </select> : field.multiline || field.type === 'list' ? <textarea id={`${titleId}-${field.name}`} className="form-control" rows={field.type === 'list' ? 3 : 5} required={required} value={value} onChange={(event) => change(event.target.value)} /> : <input id={`${titleId}-${field.name}`} className="form-control" type={field.type === 'password' ? 'password' : field.name === 'email' ? 'email' : field.type === 'date' ? field.dateOnly ? 'date' : 'datetime-local' : field.type === 'number' ? 'number' : 'text'} step={field.type === 'date' && !field.dateOnly ? '0.001' : field.type === 'number' ? '1' : undefined} required={required} minLength={field.type === 'password' ? 8 : undefined} autoComplete={field.type === 'password' ? 'new-password' : 'off'} value={value} onChange={(event) => change(event.target.value)} />}
          {field.type === 'list' && !field.options.length && <small>По одному значению в строке.</small>}
          {field.type === 'password' && !creating && <small>Оставьте пустым, чтобы сохранить текущий пароль.</small>}
          {creating && field.generated && <small>Пустое поле: значение по умолчанию.</small>}
        </div>;
      })}</div>)}
      {!creating && loaded && !deleting && <details className="admin-data__readonly"><summary>Служебные поля и статистика — только чтение</summary>
        <dl>{table.fields.filter((field) => field.readOnly || field.primary).map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{String(record[field.name] ?? '—')}</dd></div>)}</dl>
      </details>}
      <div className="admin-data__editor-footer"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Отмена</button>
        <button type="submit" className={deleting ? 'btn-secondary admin-data__danger' : 'btn-primary'} disabled={saving || loading || !loaded}>{saving ? 'Сохраняем…' : deleting ? table.name === 'Session' ? 'Отозвать' : 'Удалить' : 'Сохранить'}</button>
      </div>
    </form>
  </ModalShell>;
}
