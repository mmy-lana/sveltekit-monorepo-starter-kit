export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(2);
  return `${sec}s`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}
