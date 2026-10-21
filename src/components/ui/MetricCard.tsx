interface MetricCardProps {
  label: string;
  value: string;
  isHighlighted?: boolean;
}

/** One of the three price cards (min / average / max). */
export function MetricCard({ label, value, isHighlighted = false }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={isHighlighted ? { color: 'var(--brand)' } : undefined}>
        {value}
      </div>
    </div>
  );
}
