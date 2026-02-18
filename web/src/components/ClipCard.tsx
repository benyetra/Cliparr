interface ClipCardProps {
  clip: any;
  onCopyLink: (url: string) => void;
  onExtend: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTimeRemaining(expiresAt: string | Date): string {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = expires - now;

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ready': return 'badge-ready';
    case 'transcoding': return 'badge-transcoding';
    case 'expired': return 'badge-expired';
    case 'failed': return 'badge-failed';
    default: return 'badge-expired';
  }
}

export function ClipCard({ clip, onCopyLink, onExtend, onDelete }: ClipCardProps) {
  return (
    <div className="card clip-card">
      <div className="thumb-row">
        {clip.thumbnailPath ? (
          <img src={clip.thumbnailPath} alt={clip.title} loading="lazy" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            {clip.status === 'transcoding' ? 'Transcoding...' : 'No thumbnail'}
          </div>
        )}
        <span className={`status-badge ${statusBadgeClass(clip.status)}`}>
          {clip.status}
        </span>
      </div>
      <div className="clip-info">
        <div className="clip-title">{clip.title || clip.mediaTitle}</div>
        <div className="clip-meta">
          {clip.mediaType}{clip.seasonEpisode ? ` · ${clip.seasonEpisode}` : ''} · {formatDuration(clip.durationMs)}
        </div>
        <div className="clip-stats">
          <span>{clip.viewCount} views</span>
          <span>{formatTimeRemaining(clip.expiresAt)} remaining</span>
          {clip.maxViews && <span>Max: {clip.maxViews} views</span>}
        </div>
        <div className="clip-actions">
          {clip.status === 'ready' && (
            <button className="btn-sm btn-primary" onClick={() => onCopyLink(clip.shareUrl)}>
              Copy Link
            </button>
          )}
          <button className="btn-sm btn-secondary" onClick={() => onExtend(clip.id)}>
            Extend
          </button>
          <button className="btn-sm btn-danger" onClick={() => onDelete(clip.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
