import { useState, useEffect } from 'react';
import { settings } from '../lib/api';

export function Settings() {
  const [values, setValues] = useState({
    defaultTtlHours: 24,
    maxTtlHours: 168,
    maxClipDuration: 180,
    maxConcurrentTranscodes: 2,
    cleanupGraceHours: 24,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settings.get().then((data) => {
      setValues(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await settings.update(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading settings...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Server Settings</h1>

      <div className="settings-grid">
        <div className="settings-group">
          <h3>Clip Defaults</h3>
          <div className="settings-row">
            <label>Default TTL (hours)</label>
            <input
              type="number"
              value={values.defaultTtlHours}
              onChange={(e) => setValues({ ...values, defaultTtlHours: parseInt(e.target.value, 10) })}
              min={1}
            />
          </div>
          <div className="settings-row">
            <label>Max TTL (hours)</label>
            <input
              type="number"
              value={values.maxTtlHours}
              onChange={(e) => setValues({ ...values, maxTtlHours: parseInt(e.target.value, 10) })}
              min={1}
            />
          </div>
          <div className="settings-row">
            <label>Max Clip Duration (seconds)</label>
            <input
              type="number"
              value={values.maxClipDuration}
              onChange={(e) => setValues({ ...values, maxClipDuration: parseInt(e.target.value, 10) })}
              min={10}
              max={600}
            />
          </div>
        </div>

        <div className="settings-group">
          <h3>Transcoding</h3>
          <div className="settings-row">
            <label>Max Concurrent Transcodes</label>
            <input
              type="number"
              value={values.maxConcurrentTranscodes}
              onChange={(e) => setValues({ ...values, maxConcurrentTranscodes: parseInt(e.target.value, 10) })}
              min={1}
              max={10}
            />
          </div>
        </div>

        <div className="settings-group">
          <h3>Cleanup</h3>
          <div className="settings-row">
            <label>Cleanup Grace Period (hours)</label>
            <input
              type="number"
              value={values.cleanupGraceHours}
              onChange={(e) => setValues({ ...values, cleanupGraceHours: parseInt(e.target.value, 10) })}
              min={0}
            />
          </div>
        </div>

        <div>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
