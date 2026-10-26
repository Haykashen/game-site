import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ApiState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => Promise<void> }) {
  const { status, refresh } = useAuth();
  if (!loading && !error) return null;
  return <div className="panel account-notice" role={error ? 'alert' : 'status'}>
    <p>{error ?? 'Загружаем данные с сервера…'}</p>
    {error && <button className="btn-secondary" type="button" onClick={() => void (status === 'api' ? onRetry() : refresh())}>
      <RefreshCw size={15} aria-hidden="true" />Повторить
    </button>}
  </div>;
}
