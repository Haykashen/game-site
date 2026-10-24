import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface FeedEmptyProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Compact empty state shared by the discussions and news feeds. */
export function FeedEmpty({ icon: Icon, title, description, action }: FeedEmptyProps) {
  return (
    <div className="feed-empty">
      <span className="feed-empty__icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="feed-empty__action">{action}</div>}
    </div>
  );
}
