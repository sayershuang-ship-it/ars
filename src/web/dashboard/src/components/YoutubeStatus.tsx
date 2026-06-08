import React, { useEffect, useState } from 'react';
import { getOauthStatus, openSse } from '../api';

export default function YoutubeStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => {
    getOauthStatus().then(r => setConnected(r.connected));
  }, []);

  const handleConnect = () => {
    setAuthorizing(true);
    setLog('Opening browser for YouTube authorization…');
    const cleanup = openSse('/oauth/youtube/authorize', (data) => {
      const d = data as { raw?: string; status?: string; connected?: boolean };
      if (d.raw) setLog(d.raw);
      if (d.status === 'complete') {
        setConnected(true);
        setAuthorizing(false);
        cleanup();
      }
      if (d.status === 'error') {
        setLog('Authorization failed. Check console.');
        setAuthorizing(false);
        cleanup();
      }
    });
  };

  if (connected === null) return <span style={{ color: '#888' }}>Checking…</span>;

  return (
    <div>
      {connected
        ? <span style={{ color: '#4caf50' }}>YouTube connected</span>
        : (
          <div>
            <span style={{ color: '#f44', marginRight: 12 }}>YouTube not connected</span>
            <button onClick={handleConnect} disabled={authorizing}
              style={{ padding: '6px 14px', cursor: 'pointer', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4 }}>
              {authorizing ? 'Authorizing…' : 'Connect YouTube'}
            </button>
            {log && <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>{log}</div>}
          </div>
        )
      }
    </div>
  );
}
