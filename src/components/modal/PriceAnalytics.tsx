import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { calculatePriceAnalytics } from '../../lib/analytics';
import { formatPrice } from '../../lib/formatPrice';
import type { Lot } from '../../types';
import { MetricCard } from '../ui/MetricCard';

interface PriceAnalyticsProps {
  lots: readonly Lot[];
}

/** Min / average / max cards plus the CSS price-range track. */
export function PriceAnalytics({ lots }: PriceAnalyticsProps) {
  const analytics = useMemo(() => calculatePriceAnalytics(lots), [lots]);

  return (
    <div className="analytics-box">
      <div className="analytics-title">
        <TrendingUp size={14} style={{ color: 'var(--brand)' }} />
        <span>Аналитика рыночной стоимости</span>
      </div>

      <div className="price-metrics-grid">
        <MetricCard label="Минимум" value={formatPrice(analytics.min)} />
        <MetricCard label="Средняя" value={formatPrice(analytics.avg)} isHighlighted />
        <MetricCard label="Максимум" value={formatPrice(analytics.max)} />
      </div>

      <div className="price-range-bar-container">
        <div
          className="price-range-fill"
          style={{ left: '0%', width: `${analytics.fillWidth}%` }}
        />
        <div
          className="price-range-dot"
          style={{ left: `${analytics.averagePosition}%` }}
          title="Текущая средняя цена"
        />
      </div>

      <div className="price-range-labels">
        <span>{formatPrice(analytics.min)}</span>
        <span>{formatPrice(analytics.max)}</span>
      </div>
    </div>
  );
}
