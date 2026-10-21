import type { LucideIcon } from 'lucide-react';

interface SectionPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  chips: ReadonlyArray<string>;
}

/** Honest "coming soon" panel for sections whose data model is not built yet. */
export function SectionPlaceholder({
  icon: Icon,
  title,
  description,
  chips,
}: SectionPlaceholderProps) {
  return (
    <div className="placeholder-panel">
      <div className="placeholder-icon">
        <Icon size={26} aria-hidden="true" />
      </div>
      <span className="placeholder-kicker">В РАЗРАБОТКЕ</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="placeholder-chips">
        {chips.map((chip) => (
          <span className="placeholder-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
