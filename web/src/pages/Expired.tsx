export function Expired() {
  return (
    <div className="expired-page">
      <div className="expired-card">
        <h1>This clip has expired</h1>
        <p>The shared clip is no longer available.</p>
        <p>Clips are time-limited to protect the sharer's media server.</p>
        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          Shared via Cliparr for Plex
        </p>
      </div>
    </div>
  );
}
