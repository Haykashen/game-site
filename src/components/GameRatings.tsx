import { ExternalLink, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GameRatingSummary } from '@discvault/shared';
import { apiRequest, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { CRITIC_RATINGS } from '../data/criticRatings';
import { usePersistentState } from '../hooks/usePersistentState';

function parseLocalRatings(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).filter(([, score]) =>
    typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 10));
}

export function GameRatings({ gameId }: { gameId: string }) {
  const { status, user } = useAuth();
  return <RatingsContent key={`${gameId}:${status}:${user?.id ?? 'guest'}`} gameId={gameId} />;
}

function RatingsContent({ gameId }: { gameId: string }) {
  const { status, user } = useAuth();
  const isLocal = status === 'offline';
  const [localRatings, setLocalRatings] = usePersistentState<Record<string, number>>('discvault_game_ratings', {}, parseLocalRatings);
  const [remote, setRemote] = useState<GameRatingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(status !== 'offline');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const path = `/api/v1/catalog/games/${encodeURIComponent(gameId)}/ratings`;
  const myScore = isLocal ? localRatings[gameId] ?? null : remote?.myScore ?? null;
  const critic = CRITIC_RATINGS[gameId];

  useEffect(() => {
    if (status !== 'api') return;
    const controller = new AbortController();
    void apiRequest<GameRatingSummary>(path, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setRemote(data); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [path, status]);

  const saveScore = async (score: number | null) => {
    if (isSaving) return;
    setError('');
    setMessage('');
    if (isLocal) {
      setLocalRatings((previous) => {
        const next = { ...previous };
        if (score === null) delete next[gameId];
        else next[gameId] = score;
        return next;
      });
      setMessage(score === null ? 'Оценка удалена.' : 'Сохранено на устройстве.');
      return;
    }
    if (!user || status !== 'api') return;
    setIsSaving(true);
    try {
      const data = await apiRequest<GameRatingSummary>(path, score === null
        ? { method: 'DELETE' } : { method: 'PUT', body: { score } });
      setRemote(data);
      setMessage(score === null ? 'Оценка удалена.' : 'Оценка сохранена.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="game-ratings" aria-label="Оценки игры">
      <div className="game-rating-box">
        <div className="game-rating-head">
        <h4><Star size={15} aria-hidden="true" /> {isLocal ? 'Ваша оценка' : 'Оценка DiscVault'}</h4>
        <div className="game-rating-value">
          <strong>{isLocal ? myScore ?? '—' : remote?.average?.toFixed(1) ?? '—'}</strong><span>/ 10</span>
        </div>
        </div>
        <p className="panel-hint">{isLocal ? 'На этом устройстве'
          : isLoading ? 'Загружаем оценки…' : remote ? `Голосов: ${remote.count}` : 'Оценки пока недоступны'}</p>
        {(isLocal || user) && (
          <>
            <div className="game-rating-options" role="group" aria-label="Ваша оценка от 1 до 10">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                <button key={score} type="button" aria-pressed={myScore === score}
                  aria-label={`Оценить на ${score} из 10`} disabled={isLoading || isSaving}
                  onClick={() => void saveScore(score)}>{score}</button>
              ))}
            </div>
            <div className="game-rating-footer">
            <p className="panel-hint">{myScore === null ? 'Выберите балл' : `Ваш балл: ${myScore}/10`}</p>
            {myScore !== null && <button type="button" className="game-rating-remove" disabled={isSaving || isLoading}
              onClick={() => void saveScore(null)}>Удалить</button>}
            </div>
          </>
        )}
        {status === 'api' && !user && <p className="panel-hint"><Link className="spec-link" to="/account">Войдите</Link>, чтобы оценить игру.</p>}
        {error && <p className="market-form__error" role="alert">{error}</p>}
        <p className="panel-hint game-rating-status" role="status">{isSaving ? 'Сохраняем…' : message}</p>
      </div>
      <div className="game-rating-box">
        <div className="game-rating-head">
        <h4>Metacritic · критики</h4>
        <div className="game-rating-value"><strong>{critic?.score ?? '—'}</strong><span>/ 100</span></div>
        </div>
        {critic ? <>
          <p className="panel-hint">{critic.platform} · Metascore</p>
          <a className="spec-link game-rating-source" href={critic.url} target="_blank" rel="noopener noreferrer">
            Источник <ExternalLink size={13} aria-hidden="true" />
          </a>
          <p className="panel-hint" title="Обновляется вручную">Проверено {critic.checkedAt.split('-').reverse().join('.')}</p>
        </> : <p className="panel-hint">Оценка агрегатора для этой игры ещё не добавлена.</p>}
      </div>
    </section>
  );
}
