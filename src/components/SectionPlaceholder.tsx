import type { LucideIcon } from 'lucide-react';
import { cx } from '../lib/cx';

interface SectionPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  chips: ReadonlyArray<string>;
  /** Optional branded illustration shown beside the copy on wide screens. */
  artwork?: {
    src: string;
    alt: string;
  };
}

/** Honest "coming soon" panel for sections whose data model is not built yet. */
export function SectionPlaceholder({
  icon: Icon,
  title,
  description,
  chips,
  artwork,
}: SectionPlaceholderProps) {
  return (
    <div className={cx('placeholder-panel', Boolean(artwork) && 'placeholder-panel--with-art')}>
      {artwork && (
        <figure className="placeholder-artwork">
          <img
            src={artwork.src}
            alt={artwork.alt}
            width={1600}
            height={1000}
            decoding="async"
          />
        </figure>
      )}

      <div className="placeholder-body">
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
    </div>
  );
}
