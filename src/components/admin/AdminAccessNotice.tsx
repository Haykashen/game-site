import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
export function AdminAccessNotice() {
  const {status, user} = useAuth();
  return <div className="panel account-notice"><div><strong>{status === 'checking' ? 'Проверяем доступ…' : status === 'offline' ? 'Нет подключения к API' : 'Раздел доступен только администраторам'}</strong>
    <p>{status === 'checking' ? 'Загружаем данные аккаунта.' : status === 'offline' ? 'Запустите API с PostgreSQL и повторите загрузку.' : 'Для управления данными войдите в аккаунт администратора.'}</p></div>
    {!user && status === 'api' && <Link to="/account" className="btn-secondary">Войти</Link>}
  </div>;
}
