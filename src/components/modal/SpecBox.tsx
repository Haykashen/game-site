import type { Game } from '../../types';
import { SpecRow } from '../ui/SpecRow';

interface SpecBoxProps {
  game: Game;
}

/** Publisher / language specification card. */
export function SpecBox({ game }: SpecBoxProps) {
  return (
    <div className="spec-box">
      <h4>Спецификация</h4>
      <SpecRow label="Издатель" value={game.publisher} />
      <SpecRow label="Язык" value={game.lang} />
    </div>
  );
}
