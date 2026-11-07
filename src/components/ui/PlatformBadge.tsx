import { PLATFORMS, getPlatformBadgeStyle } from '../../data/reference';

/** One platform label and colour scheme for catalogue and collection cards. */
export function PlatformBadge({platform}: {platform: string}) {
  const name = PLATFORMS.find(item => item.name.toLowerCase() === platform.trim().toLowerCase())?.name ?? platform;
  return <span className="badge-platform badge-platform--static" data-platform={name} style={getPlatformBadgeStyle(name)}>{name}</span>;
}
