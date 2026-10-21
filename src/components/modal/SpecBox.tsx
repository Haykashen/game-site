import type { Game } from '../../types';
import { SpecRow } from '../ui/SpecRow';

interface SpecBoxProps {
  game: Game;
}

const EMPTY_VALUE = '—';

/** Publisher, developer and physical-edition details of the release. */
export function SpecBox({ game }: SpecBoxProps) {
  return (
    <div className="spec-box">
      <h4>Спецификация</h4>
      <SpecRow label="Издатель" value={game.publisher} />
      <SpecRow label="Разработчик" value={game.developer || EMPTY_VALUE} />
      <SpecRow label="Серия" value={game.series || EMPTY_VALUE} />
      <SpecRow label="Издание" value={game.edition || EMPTY_VALUE} />
      <SpecRow label="Носитель" value={game.media || EMPTY_VALUE} />
      <SpecRow label="Язык" value={game.lang} />
    </div>
  );
}
