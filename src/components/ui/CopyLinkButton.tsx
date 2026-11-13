import { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export function CopyLinkButton({url, className = ''}: {url: string; className?: string}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {if (timer.current) clearTimeout(timer.current);}, []);
  return <button type="button" className={'btn-secondary copy-link-button ' + className}
    title={state === 'failed' ? 'Не удалось скопировать ссылку. Нажмите, чтобы повторить.' : undefined}
    onClick={async () => {
      if (timer.current) clearTimeout(timer.current);
      try {await navigator.clipboard.writeText(url); setState('copied');}
      catch {setState('failed');}
      timer.current = setTimeout(() => {setState('idle'); timer.current = null;}, 3000);
    }}>
    {state === 'copied' ? <Check size={17} aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
    <span className="copy-link-button__label">
      <span aria-hidden="true" className="copy-link-button__reserve">Поделиться</span>
      <span aria-hidden="true" className="copy-link-button__reserve">Скопировано</span>
      <span aria-live="polite" aria-atomic="true">{state === 'copied' ? 'Скопировано' : state === 'failed' ? 'Повторить' : 'Поделиться'}</span>
    </span>
  </button>;
}
