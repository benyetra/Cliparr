interface VideoPreviewProps {
  thumbUrl?: string | null;
}

export function VideoPreview({ thumbUrl }: VideoPreviewProps) {
  return (
    <div style={{
      aspectRatio: '16/9',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: 800,
    }}>
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt="Preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          Preview will appear here
        </span>
      )}
    </div>
  );
}
