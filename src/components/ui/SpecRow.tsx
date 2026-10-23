import type { ReactNode } from 'react';

interface SpecRowProps {
  label: string;
  value: ReactNode;
}

/** Single key/value row inside the specification box. */
export function SpecRow({ label, value }: SpecRowProps) {
  return (
    <div className="spec-row">
      <span className="spec-label">{label}:</span>
      <span className="spec-value">{value}</span>
    </div>
  );
}
