import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPlan, savePlan } from '../api';

export default function Plan() {
  const { epId } = useParams<{ epId: string }>();
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!epId) return;
    getPlan(epId).then(r => setContent(r.content)).catch(console.error);
  }, [epId]);

  const handleSave = async () => {
    if (!epId) return;
    await savePlan(epId, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1>Plan — {epId}</h1>
      <textarea value={content} onChange={e => setContent(e.target.value)}
        style={{ width: '100%', height: 'calc(100vh - 180px)', fontFamily: 'monospace', fontSize: 13, background: '#111', color: '#eee', border: '1px solid #333', padding: 12, borderRadius: 4, boxSizing: 'border-box' }} />
      <button onClick={handleSave}
        style={{ marginTop: 8, padding: '8px 20px', cursor: 'pointer', background: saved ? '#4caf50' : '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
