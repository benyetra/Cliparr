import { useRef, useCallback } from 'react';

interface TimelineScrubberProps {
  totalDurationMs: number;
  startMs: number;
  endMs: number;
  maxDurationMs: number;
  onStartChange: (ms: number) => void;
  onEndChange: (ms: number) => void;
}

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

export function TimelineScrubber({
  totalDurationMs,
  startMs,
  endMs,
  maxDurationMs,
  onStartChange,
  onEndChange,
}: TimelineScrubberProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const msToPercent = (ms: number) => totalDurationMs > 0 ? (ms / totalDurationMs) * 100 : 0;
  const percentToMs = (pct: number) => Math.round((pct / 100) * totalDurationMs);

  const getMouseMs = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    return percentToMs(pct);
  }, [totalDurationMs]);

  function handleBarClick(e: React.MouseEvent) {
    const ms = getMouseMs(e);
    // Click closer to start or end handle?
    const distToStart = Math.abs(ms - startMs);
    const distToEnd = Math.abs(ms - endMs);
    if (distToStart < distToEnd) {
      onStartChange(Math.min(ms, endMs - 1000));
    } else {
      const newEnd = Math.min(ms, startMs + maxDurationMs);
      onEndChange(Math.max(newEnd, startMs + 1000));
    }
  }

  function startDrag(type: 'start' | 'end') {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const onMove = (ev: MouseEvent) => {
        const ms = getMouseMs(ev);
        if (type === 'start') {
          const clamped = Math.max(0, Math.min(ms, endMs - 1000));
          // Enforce max duration
          if (endMs - clamped > maxDurationMs) return;
          onStartChange(clamped);
        } else {
          const clamped = Math.min(totalDurationMs, Math.max(ms, startMs + 1000));
          if (clamped - startMs > maxDurationMs) {
            onEndChange(startMs + maxDurationMs);
          } else {
            onEndChange(clamped);
          }
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  }

  const durationMs = endMs - startMs;
  const durationSec = Math.round(durationMs / 1000);
  const maxSec = maxDurationMs / 1000;

  return (
    <div className="timeline-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span>IN: {formatTime(startMs)}</span>
        <span>OUT: {formatTime(endMs)}</span>
      </div>

      <div className="timeline-bar" ref={barRef} onClick={handleBarClick}>
        {/* Selected region */}
        <div
          className="timeline-selection"
          style={{
            left: `${msToPercent(startMs)}%`,
            width: `${msToPercent(durationMs)}%`,
          }}
        />

        {/* Start handle */}
        <div
          className="timeline-handle"
          style={{ left: `calc(${msToPercent(startMs)}% - 6px)` }}
          onMouseDown={startDrag('start')}
        />

        {/* End handle */}
        <div
          className="timeline-handle"
          style={{ left: `calc(${msToPercent(endMs)}% - 6px)` }}
          onMouseDown={startDrag('end')}
        />
      </div>

      <div className="timeline-controls">
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-sm btn-secondary" onClick={() => onStartChange(Math.max(0, startMs - 1000))}>
            IN -1s
          </button>
          <button className="btn-sm btn-secondary" onClick={() => onStartChange(Math.min(startMs + 1000, endMs - 1000))}>
            IN +1s
          </button>
          <button className="btn-sm btn-secondary" onClick={() => onEndChange(Math.max(endMs - 1000, startMs + 1000))}>
            OUT -1s
          </button>
          <button className="btn-sm btn-secondary" onClick={() => {
            const newEnd = Math.min(endMs + 1000, totalDurationMs, startMs + maxDurationMs);
            onEndChange(newEnd);
          }}>
            OUT +1s
          </button>
        </div>
        <span className="timeline-duration">
          {formatTime(durationMs)} / {formatTime(maxDurationMs)} max
        </span>
      </div>
    </div>
  );
}
