import { useState, useEffect } from 'react';
import { useClipList } from '../hooks/useClips';
import { ClipCard } from '../components/ClipCard';
import { clips as clipsApi } from '../lib/api';

export function Dashboard() {
  const { clips, loading, load, refresh } = useClipList();
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    load(filter ? { status: filter } : undefined);
  }, [filter, load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this clip? This cannot be undone.')) return;
    await clipsApi.delete(id);
    refresh();
  }

  async function handleExtend(id: string) {
    await clipsApi.update(id, { ttlHours: 24 });
    refresh();
  }

  function handleCopyLink(shareUrl: string) {
    navigator.clipboard.writeText(shareUrl);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>My Clips</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['', 'ready', 'transcoding', 'expired', 'failed'].map((s) => (
            <button
              key={s}
              className={filter === s ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />Loading clips...</div>
      ) : clips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No clips yet</p>
          <p>Browse your library and create your first clip!</p>
        </div>
      ) : (
        <div className="clip-grid">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onCopyLink={handleCopyLink}
              onExtend={handleExtend}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
