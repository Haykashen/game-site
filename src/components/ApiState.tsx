
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ApiState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => Promise<void> }) {
  const { status, refresh } = useAuth();
  if (!loading && !error) return null;

  return <div className="panel account-notice api-state" role={loading ? 'status' : 'alert'} aria-live="polite" aria-busy={loading}>
    <p>{loading ? 'Загружаем данные с сервера…' : error}</p>
    <button className="btn-secondary" type="button" disabled={loading} onClick={() => void (status === 'api' ? onRetry() : refresh())}>
      <RefreshCw className={loading ? 'loading-state__icon' : undefined} size={15} aria-hidden="true" />Повторить
    </button>
  </div>;
}
