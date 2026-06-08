import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStudioPort } from '../api';

export default function Review() {
  const { epId } = useParams<{ epId: string }>();
  const [port, setPort] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!epId) return;
    getStudioPort(epId)
      .then(r => setPort(r.port))
      .catch(e => setError(String(e)));
  }, [epId]);

  const studioUrl = port
    ? `http://localhost:${port}/?series=Youtube-studio&ep=${epId}&phase=review`
    : null;

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Review — {epId}</h1>
        {studioUrl && (
          <a href={studioUrl} target="_blank" rel="noreferrer"
            style={{ color: '#90caf9', fontSize: 13 }}>Open in new tab</a>
        )}
      </div>
      {error && <p style={{ color: '#f44' }}>{error}</p>}
      {!port && !error && <p style={{ color: '#888' }}>Starting Studio…</p>}
      {studioUrl && (
        <iframe src={studioUrl} style={{ flex: 1, border: '1px solid #333', borderRadius: 4 }} />
      )}
    </div>
  );
}
