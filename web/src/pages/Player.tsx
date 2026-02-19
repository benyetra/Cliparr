import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface ClipData {
  clipId: string;
  title?: string;
  mediaTitle?: string;
  durationMs?: number;
  status?: string;
  isExpired: boolean;
  isValid: boolean;
  streamUrl: string | null;
  thumbnailUrl: string | null;
}

export function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [clipData, setClipData] = useState<ClipData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clip data is injected by the server into the HTML
    const data = (window as any).__CLIP_DATA__ as ClipData | undefined;
    if (data) {
      setClipData(data);
    } else {
      // Fallback: parse from URL and fetch from API
      const path = window.location.pathname;
      const match = path.match(/\/c\/(.+)/);
      const params = new URLSearchParams(window.location.search);
      if (match) {
        setClipData({
          clipId: match[1],
          isExpired: false,
          isValid: !!params.get('t'),
          streamUrl: params.get('t') ? `/stream/${match[1]}/master.m3u8?t=${params.get('t')}` : null,
          thumbnailUrl: null,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!clipData?.streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = clipData.streamUrl;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(clipData.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError('Playback error. The clip may have expired.');
        }
      });
      hlsRef.current = hls;
    } else {
      setError('Your browser does not support HLS playback.');
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [clipData?.streamUrl]);

  // Track view
  useEffect(() => {
    if (!clipData?.streamUrl || !clipData.clipId) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    if (!token) return;

    const startTime = Date.now();
    const handleUnload = () => {
      const watchDurationMs = Date.now() - startTime;
      const watchPercentage = clipData.durationMs
        ? Math.min(100, (watchDurationMs / clipData.durationMs) * 100)
        : 0;

      // Use sendBeacon for reliable delivery
      navigator.sendBeacon(
        `/stream/${clipData.clipId}/view?t=${token}`,
        JSON.stringify({ watchDurationMs, watchPercentage }),
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [clipData]);

  if (!clipData) {
    return <div className="loading"><div className="spinner" />Loading...</div>;
  }

  if (clipData.isExpired) {
    return (
      <div className="expired-page">
        <div className="expired-card">
          <h1>This clip has expired</h1>
          {clipData.title && <p style={{ fontSize: 18 }}>{clipData.title}</p>}
          <p>The shared clip is no longer available. Clips are time-limited for security.</p>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Shared via Cliparr for Plex
          </p>
        </div>
      </div>
    );
  }

  if (clipData.status === 'transcoding' || clipData.status === 'pending') {
    return (
      <div className="player-page">
        <div className="player-container">
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="spinner" style={{ marginBottom: 16 }} />
            <h2>Clip is still being prepared...</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              This clip is currently being transcoded. Please try again in a moment.
            </p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>
          <div className="player-info">
            {clipData.title && <h1>{clipData.title}</h1>}
            <p className="player-branding">Shared via Cliparr for Plex</p>
          </div>
        </div>
      </div>
    );
  }

  if (clipData.status === 'failed') {
    return (
      <div className="player-page">
        <div className="player-container">
          <div style={{ padding: 60, textAlign: 'center' }}>
            <h2 style={{ color: 'var(--danger)' }}>Clip generation failed</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              There was an error preparing this clip. The owner may need to recreate it.
            </p>
          </div>
          <div className="player-info">
            {clipData.title && <h1>{clipData.title}</h1>}
            <p className="player-branding">Shared via Cliparr for Plex</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-page">
      <div className="player-container">
        {error ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="player-video"
            controls
            autoPlay
            playsInline
            poster={clipData.thumbnailUrl || undefined}
          />
        )}
        <div className="player-info">
          {clipData.title && <h1>{clipData.title}</h1>}
          {clipData.mediaTitle && clipData.mediaTitle !== clipData.title && (
            <p className="media-source">From: {clipData.mediaTitle}</p>
          )}
          <p className="player-branding">Shared via Cliparr for Plex</p>
        </div>
      </div>
    </div>
  );
}
