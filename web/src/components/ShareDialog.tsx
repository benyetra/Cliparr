import { useState, useEffect } from 'react';

interface ShareDialogProps {
  shareUrl: string;
  clipId: string;
  title: string;
  onClose: () => void;
}

interface ShareLinks {
  url: string;
  links: {
    imessage: string;
    whatsapp: string;
    telegram: string;
    twitter: string;
    email: string;
  };
}

export function ShareDialog({ shareUrl, clipId, title, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLinks | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    // Fetch QR code and share links
    const token = localStorage.getItem('cliparr_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/v1/clips/${clipId}/qr`, { headers, credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setQrDataUrl(data.qrDataUrl))
      .catch(() => {});

    fetch(`/api/v1/clips/${clipId}/share-links`, { headers, credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setShareLinks(data))
      .catch(() => {});
  }, [clipId]);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator.share({ title, url: shareUrl }).catch(() => {});
    }
  }

  return (
    <div className="share-dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Share Your Clip</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Your clip is being generated. The link will work as soon as transcoding completes.
        </p>

        <div className="share-url">
          <input type="text" value={shareUrl} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
          <button className="btn-primary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Platform share buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
          {typeof navigator.share === 'function' && (
            <button className="btn-sm btn-secondary" onClick={handleNativeShare}>
              Share...
            </button>
          )}
          {shareLinks && (
            <>
              <a href={shareLinks.links.imessage} className="btn-sm btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                iMessage
              </a>
              <a href={shareLinks.links.whatsapp} target="_blank" rel="noopener" className="btn-sm btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                WhatsApp
              </a>
              <a href={shareLinks.links.telegram} target="_blank" rel="noopener" className="btn-sm btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Telegram
              </a>
              <a href={shareLinks.links.twitter} target="_blank" rel="noopener" className="btn-sm btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Twitter/X
              </a>
              <a href={shareLinks.links.email} className="btn-sm btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Email
              </a>
            </>
          )}
          <button className="btn-sm btn-secondary" onClick={() => setShowQr(!showQr)}>
            {showQr ? 'Hide QR' : 'QR Code'}
          </button>
        </div>

        {/* QR Code */}
        {showQr && qrDataUrl && (
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <img src={qrDataUrl} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 8 }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Scan to open clip</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
