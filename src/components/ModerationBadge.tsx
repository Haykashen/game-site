export function ModerationBadge({status}: {status?: string | undefined}) {
  if (!status || status === 'visible') return null;
  const labels: Record<string, string> = {draft: 'Черновик', pending: 'Требует проверки', hidden: 'Отклонено', removed: 'Снято с публикации'};
  return <span className="meta-chip" role="status">{labels[status] ?? status}</span>;
}
