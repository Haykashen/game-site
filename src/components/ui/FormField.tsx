import type { CSSProperties, ReactNode } from 'react';

const LABEL_STYLE: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  display: 'block',
  marginBottom: '0.25rem',
};

interface FormFieldProps {
  id: string;
  label: string;
  children: ReactNode;
}

/** Label + control pair for the "create lot" form. */
export function FormField({ id, label, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="spec-label" style={LABEL_STYLE}>
        {label}
      </label>
      {children}
    </div>
  );
}
