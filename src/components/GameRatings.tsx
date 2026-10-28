import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GameRatingSummary } from '@discvault/shared';
import { apiRequest, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { CRITIC_RATINGS } from '../data/criticRatings';

export function GameRatings({ gameId }: { gameId: string }) {
  const { status, user } = useAuth();
  return <RatingsContent key={`${gameId}:${status}:${user?.id ?? 'guest'}`} gameId={gameId} />;
}

function RatingsContent({ gameId }: { gameId: string }) {
  const { status, user } = useAuth();
  const [remote, setRemote] = useState<GameRatingSummary | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(status === 'api' || status === 'checking');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const critic = CRITIC_RATINGS[gameId];
  const path = `/api/v1/catalog/games/${encodeURIComponent(gameId)}/ratings`;

  useEffect(() => {
    if (status !== 'api') { setLoading(false); return; }
    const controller = new AbortController();
    void apiRequest<GameRatingSummary>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setRemote(data); setDraft(data.myScore === null ? '' : String(data.myScore)); } })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, status]);

  async function save(input: HTMLInputElement) {
    if (loading || saving || !user || status !== 'api') return;
    if (!input.validity.valid) { input.reportValidity(); return; }
    const score = draft === '' ? null : Number(draft);
    if (score === (remote?.myScore ?? null)) return;
    setSaving(true); setError('');
    try {
      const data = await apiRequest<GameRatingSummary>(path, score === null ? { method: 'DELETE' } : { method: 'PUT', body: { score } });
      setRemote(data);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }

  return <div className="game-detail__ratings">
    <dl className="game-detail__facts">
      <div><dt>Metacritic</dt><dd>{critic ? <a className="game-detail__critic" href={critic.url} target="_blank" rel="noopener noreferrer" title={`Metacritic · ${critic.platform}`}><span>{critic.score}/100</span><ExternalLink size={12} aria-hidden="true" /></a> : '—'}</dd></div>
      <div><dt>DiscVault</dt><dd title={remote ? `Голосов: ${remote.count}` : undefined}>{loading ? '…' : remote?.average?.toFixed(1) ?? '—'} / 10</dd></div>
      <div><dt><label htmlFor="game-user-score">Ваша оценка</label></dt><dd>{user && status === 'api' ? <><input id="game-user-score" className="game-detail__score" type="number" min={0} max={10} step={1} inputMode="numeric" placeholder="—" value={draft} disabled={loading || saving} aria-label="Ваша оценка от 0 до 10" onChange={event => setDraft(event.target.value)} onBlur={event => void save(event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(event.currentTarget); } }} /> / 10</> : <Link className="spec-link" to="/account">Войдите, чтобы оценить</Link>}</dd></div>
    </dl>
    {error && <p className="market-form__error" role="alert">{error}</p>}
  </div>;
}