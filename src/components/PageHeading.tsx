import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  /** Optional call to action shown to the right of the heading copy. */
  action?: ReactNode;
}

/** Compact heading shared by every page that is not the catalogue. */
export function PageHeading({ eyebrow, title, description, action }: PageHeadingProps) {
  return (
    <div className={cx('page-heading', Boolean(action) && 'page-heading--with-action')}>
      <div className="page-heading__copy">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {action && <div className="page-heading__action">{action}</div>}
    </div>
  );
}
