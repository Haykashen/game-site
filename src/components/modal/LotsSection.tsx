import type { CSSProperties } from 'react';
import type { Game, LotType } from '../../types';
import { Tabs } from '../ui/Tabs';
import { LotItem } from './LotItem';

interface LotsSectionProps {
  game: Game;
  activeTab: LotType;
  onChangeTab: (tab: LotType) => void;
}

const EMPTY_STATE_STYLE: CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-muted)',
  padding: '1.5rem 0',
  fontSize: '0.85rem',
};

/** Sale / purchase tabs with their listings. */
export function LotsSection({ game, activeTab, onChangeTab }: LotsSectionProps) {
  const salesLots = game.lots.filter((lot) => lot.type === 'sale');
  const purchaseLots = game.lots.filter((lot) => lot.type === 'purchase');
  const visibleLots = activeTab === 'sale' ? salesLots : purchaseLots;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Tabs
        items={[
          { id: 'sale', label: `Лоты продаж (${salesLots.length})` },
          { id: 'purchase', label: `Лоты покупок (${purchaseLots.length})` },
        ]}
        value={activeTab}
        onChange={onChangeTab}
        containerClassName="tabs-header"
        buttonClassName="tab-btn"
        ariaLabel="Лоты по игре"
      />

      <div style={{ flex: 1, marginTop: '0.5rem' }}>
        {visibleLots.length === 0 ? (
          <div style={EMPTY_STATE_STYLE}>Нет активных объявлений</div>
        ) : (
          visibleLots.map((lot) => <LotItem key={lot.id} lot={lot} />)
        )}
      </div>
    </div>
  );
}
