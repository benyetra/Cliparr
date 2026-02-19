import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { library } from '../lib/api';
import { useClipCreate } from '../hooks/useClips';
import { TimelineScrubber } from '../components/TimelineScrubber';
import { VideoPreview, type VideoPreviewHandle } from '../components/VideoPreview';
import { ShareDialog } from '../components/ShareDialog';

export function ClipEditor() {
  const { ratingKey } = useParams<{ ratingKey: string }>();
  const navigate = useNavigate();
  const { creating, result, create } = useClipCreate();
  const videoRef = useRef<VideoPreviewHandle>(null);

  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(30000); // Default 30 seconds
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [title, setTitle] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [maxViews, setMaxViews] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);

  const handleTimeUpdate = useCallback((ms: number) => {
    setCurrentTimeMs(ms);
  }, []);

  useEffect(() => {
    if (!ratingKey) return;
    library.metadata(ratingKey).then((data) => {
      setMetadata(data);
      setLoading(false);
      // Set initial end to 30s or full duration, whichever is smaller
      const maxMs = Math.min(30000, data.duration || 30000);
      setEndMs(maxMs);
    }).catch(() => {
      setLoading(false);
    });
  }, [ratingKey]);

  async function handleCreateClip() {
    if (!ratingKey) return;
    const res = await create({
      ratingKey,
      startMs,
      endMs,
      title: title || undefined,
      ttlHours,
      maxViews: maxViews ?? undefined,
    });
    if (res) {
      setShowShare(true);
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading media info...</div>;
  }

  if (!metadata) {
    return <p style={{ color: 'var(--danger)' }}>Failed to load media. <button className="btn-secondary btn-sm" onClick={() => navigate(-1)}>Go Back</button></p>;
  }

  const durationMs = endMs - startMs;
  const maxDurationMs = 180000; // 3 minutes
  const mediaTitle = metadata.grandparentTitle
    ? `${metadata.grandparentTitle} - ${metadata.title}`
    : `${metadata.title}${metadata.year ? ` (${metadata.year})` : ''}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-sm btn-secondary" onClick={() => navigate(-1)}>Back</button>
        <div>
          <h1 style={{ fontSize: 22 }}>{mediaTitle}</h1>
          {metadata.seasonEpisode && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{metadata.seasonEpisode}</p>
          )}
        </div>
      </div>

      {/* Video Preview */}
      <VideoPreview
        ref={videoRef}
        ratingKey={ratingKey!}
        thumbUrl={metadata.thumbUrl}
        startMs={startMs}
        endMs={endMs}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Quick seek buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn-sm btn-secondary" onClick={() => videoRef.current?.seekTo(startMs)}>
          Jump to IN
        </button>
        <button className="btn-sm btn-secondary" onClick={() => videoRef.current?.seekTo(endMs)}>
          Jump to OUT
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setStartMs(Math.round(currentTimeMs))}>
          Set IN to current
        </button>
        <button className="btn-sm btn-secondary" onClick={() => {
          const newEnd = Math.min(Math.round(currentTimeMs), startMs + maxDurationMs);
          if (newEnd > startMs) setEndMs(newEnd);
        }}>
          Set OUT to current
        </button>
      </div>

      {/* Timeline Scrubber */}
      <TimelineScrubber
        totalDurationMs={metadata.duration || 0}
        startMs={startMs}
        endMs={endMs}
        currentTimeMs={currentTimeMs}
        maxDurationMs={maxDurationMs}
        onStartChange={setStartMs}
        onEndChange={setEndMs}
        onSeek={(ms) => videoRef.current?.seekTo(ms)}
      />

      {/* Clip Configuration */}
      <div style={{ marginTop: 20, display: 'grid', gap: 16, maxWidth: 600 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
            Custom Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mediaTitle}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
            Link Expires After
          </label>
          <div className="ttl-options">
            {[1, 6, 12, 24, 48, 72, 168].map((h) => (
              <button
                key={h}
                className={`ttl-option ${ttlHours === h ? 'active' : ''}`}
                onClick={() => setTtlHours(h)}
              >
                {h < 24 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
            Max Views (leave empty for unlimited)
          </label>
          <input
            type="number"
            min={1}
            value={maxViews ?? ''}
            onChange={(e) => setMaxViews(e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="Unlimited"
            style={{ width: 120 }}
          />
        </div>
      </div>

      {/* Generate Button */}
      <div style={{ marginTop: 28 }}>
        <button
          className="btn-primary"
          onClick={handleCreateClip}
          disabled={creating || durationMs <= 0 || durationMs > maxDurationMs}
          style={{ fontSize: 16, padding: '14px 32px' }}
        >
          {creating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Generating...
            </span>
          ) : (
            'Generate & Share Link'
          )}
        </button>
      </div>

      {showShare && result && (
        <ShareDialog
          shareUrl={result.shareUrl}
          clipId={result.id}
          title={result.title}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
