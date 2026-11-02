export function isActiveAuction(entry: {kind: string; status: string; moderationStatus?: string | undefined}): boolean {
  return entry.kind === 'auction' && entry.status === 'active' && entry.moderationStatus === 'visible';
}
