interface MediaGridProps {
  items: any[];
  onItemClick: (item: any) => void;
}

export function MediaGrid({ items, onItemClick }: MediaGridProps) {
  return (
    <div className="media-grid">
      {items.map((item) => (
        <div
          key={item.ratingKey}
          className="card media-card"
          onClick={() => onItemClick(item)}
        >
          <div className="thumb">
            {item.thumbUrl ? (
              <img src={item.thumbUrl} alt={item.title} loading="lazy" />
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 40 }}>
                {item.type === 'movie' ? '\u{1F3AC}' : item.type === 'show' ? '\u{1F4FA}' : '\u{1F3B5}'}
              </span>
            )}
          </div>
          <div className="info">
            <h3>{item.title}</h3>
            <p>
              {item.year && `${item.year} · `}
              {item.type}
              {item.grandparentTitle && ` · ${item.grandparentTitle}`}
              {item.parentIndex != null && item.index != null && (
                ` · S${String(item.parentIndex).padStart(2, '0')}E${String(item.index).padStart(2, '0')}`
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
