import { Link } from 'react-router-dom';
import { demoProfileId, getDemoProfile } from '../lib/publicProfiles';

interface ProfileLinkProps {
  name: string;
  userId?: string | undefined;
  className?: string;
}

export function ProfileLink({ name, userId, className = 'spec-link' }: ProfileLinkProps) {
  const id = userId ?? demoProfileId(name);
  if (!userId && !getDemoProfile(id)) return <span>{name}</span>;
  return (
    <Link
      className={className}
      to={`/users/${encodeURIComponent(id)}`}
      aria-label={`Профиль пользователя ${name}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {name}
    </Link>
  );
}
