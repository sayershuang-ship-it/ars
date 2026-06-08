import React, { useEffect, useState } from 'react';
import { openSse } from '../api';

interface Props {
  url: string;
  body?: Record<string, unknown>;
  onComplete?: () => void;
}

export default function ProgressStream({ url, body, onComplete }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLines([]);
    setDone(false);
    const cleanup = openSse(url, (data) => {
      const raw = data as { raw?: string; status?: string };
      if (raw.raw) setLines(l => [...l, raw.raw!]);
      if (raw.status === 'complete') { setDone(true); onComplete?.(); }
      if (raw.status === 'error') setDone(true);
    }, body);
    return cleanup;
  }, [url]);

  return (
    <div style={{ background: '#1a1a1a', color: '#eee', padding: 12, borderRadius: 6, fontFamily: 'monospace', fontSize: 12, maxHeight: 300, overflowY: 'auto' }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
      {done && <div style={{ color: '#4caf50', marginTop: 4 }}>Done</div>}
    </div>
  );
}
