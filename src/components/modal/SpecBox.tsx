import { editionsCountLabel } from '../../lib/market';
import type { Game } from '../../types';
import { SpecRow } from '../ui/SpecRow';

interface SpecBoxProps {
  game: Game;
  platforms: readonly string[];
  editionCount: number;
}

const EMPTY_VALUE = '—';

/** Abstract game facts: who made it, when it came out and on what. */
export function SpecBox({ game, platforms, editionCount }: SpecBoxProps) {
  return (
    <div className="spec-box">
      <h4>Спецификация</h4>
      <SpecRow label="Издатель" value={game.publisher || EMPTY_VALUE} />
      <SpecRow label="Разработчик" value={game.developer || EMPTY_VALUE} />
      <SpecRow label="Серия" value={game.series || EMPTY_VALUE} />
      <SpecRow label="Платформы" value={platforms.join(', ') || EMPTY_VALUE} />
      <SpecRow label="Жанры" value={game.genres.join(', ') || EMPTY_VALUE} />
      <SpecRow label="Первый выпуск" value={game.year === null ? EMPTY_VALUE : String(game.year)} />
      <SpecRow label="Изданий" value={editionsCountLabel(editionCount)} />
    </div>
  );
}
