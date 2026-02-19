import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface VideoPreviewHandle {
  seekTo: (ms: number) => void;
  getCurrentTime: () => number;
}

interface VideoPreviewProps {
  directStreamUrl: string | null;
  thumbUrl?: string | null;
  startMs?: number;
  endMs?: number;
  onTimeUpdate?: (currentMs: number) => void;
}

export const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(
  function VideoPreview({ directStreamUrl, thumbUrl, startMs, endMs, onTimeUpdate }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo(ms: number) {
        if (videoRef.current) {
          videoRef.current.currentTime = ms / 1000;
        }
      },
      getCurrentTime() {
        return videoRef.current ? videoRef.current.currentTime * 1000 : 0;
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !onTimeUpdate) return;

      const handler = () => onTimeUpdate(video.currentTime * 1000);
      video.addEventListener('timeupdate', handler);
      return () => video.removeEventListener('timeupdate', handler);
    }, [onTimeUpdate]);

    return (
      <div style={{
        aspectRatio: '16/9',
        background: '#000',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 16,
        maxWidth: 800,
        position: 'relative',
      }}>
        {directStreamUrl ? (
          <video
            ref={videoRef}
            src={directStreamUrl}
            poster={thumbUrl || undefined}
            controls
            preload="metadata"
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {thumbUrl ? (
              <img src={thumbUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No preview available</span>
            )}
          </div>
        )}
        {startMs != null && endMs != null && (
          <div style={{
            position: 'absolute',
            bottom: 48,
            left: 12,
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}>
            Clip: {formatTime(startMs)} - {formatTime(endMs)}
          </div>
        )}
      </div>
    );
  },
);

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
