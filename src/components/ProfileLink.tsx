import { Link } from 'react-router-dom';

interface ProfileLinkProps {
  name: string;
  userId?: string | undefined;
  className?: string;
}

export function ProfileLink({ name, userId, className = 'spec-link' }: ProfileLinkProps) {
  if (!userId) return <span>{name}</span>;
  const id = userId;
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
