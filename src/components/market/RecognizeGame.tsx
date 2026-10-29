import { prepareMarketPhoto } from '../../lib/photos';
import { useRef, useState } from 'react';
import { apiRequest, errorMessage } from '../../api';
import type { Edition, Game } from '../../types';
interface Match {game: Game; edition: Edition}
interface Result {facts: {title: string; platform: string; edition: string; region: string; language: string}; matches: Match[]; token: string}
export function RecognizeGame({onSelect, photo}: {onSelect: (match: Match, source: string) => void; photo?: string | undefined}) {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const snapshot = useRef('');
  async function recognize() {
    if (busy) return;
    setBusy(true); setError(''); setResult(null); snapshot.current = source || photo || '';
    try {setResult(await apiRequest<Result>('/api/v1/recognition/game', {method: 'POST', body: {source: snapshot.current}}));}
    catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function confirm() {
    if (!result || busy) return; setBusy(true); setError('');
    try {const match = await apiRequest<Match>('/api/v1/recognition/game/confirm', {method: 'POST', body: {token: result.token}});onSelect(match, snapshot.current);setResult(null);}
    catch(cause) {setError(errorMessage(cause));} finally {setBusy(false);}
  }
  return <section className="recognize-game" aria-label="Заполнить по фотографии"><strong>Заполнить по фотографии</strong><p className="panel-hint">Фото будет отправлено Gemini для распознавания. Проверьте результат перед применением.</p><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
    <label>Ссылка на изображение<input className="form-control" type="url" placeholder="https://…" value={source.startsWith('data:') ? '' : source} onChange={event=>{setSource(event.target.value);setResult(null);}} /></label>
    <label>Или файл JPEG, PNG, WebP (до 5 МБ)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){setError('Максимальный размер — 5 МБ.');return;}setBusy(true);setResult(null);void prepareMarketPhoto(file).then(value=>{setSource(value);setError('');}).catch(cause=>setError(errorMessage(cause))).finally(()=>setBusy(false));}} /></label>
    {source.startsWith('data:') && <p className="panel-hint">Фотография выбрана</p>}
    <button type="button" className="btn-secondary" disabled={!(source||photo)} onClick={()=>void recognize()}>{busy?'Распознаём…':'Распознать игру'}</button>
  </fieldset>
  {error && <p role="alert" className="market-form__error">{error} Можно продолжить вручную.</p>}
  {result && <div><p>{result.facts.title} · {result.facts.platform} · {result.facts.edition}</p>{result.matches.length ? <><p className="panel-hint">Подтвердите подходящее издание:</p>{result.matches.map(match=><button type="button" className="btn-secondary" key={match.edition.id} onClick={()=>{onSelect(match,snapshot.current);setResult(null);}}>{match.game.title} · {match.edition.name} · {match.edition.region} · {match.edition.lang}</button>)}</> : <><p className="panel-hint">Точного совпадения нет. После подтверждения создадим записи с пометкой для проверки модератором. Регион: {result.facts.region||'не определён'}, язык: {result.facts.language||'не определён'}.</p><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void confirm()}>Подтвердить и добавить в каталог</button></>}</div>}
  </section>;
}