import type { ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}

/** Label + control pair used by the marketplace placement form. */
export function FormField({ id, label, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {children}
    </div>
  );
}
