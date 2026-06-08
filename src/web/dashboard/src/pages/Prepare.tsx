import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPrepare, selectCandidate, PrepareArtifact, Candidate } from '../api';

export default function Prepare() {
  const { epId } = useParams<{ epId: string }>();
  const [artifact, setArtifact] = useState<PrepareArtifact | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!epId) return;
    getPrepare(epId)
      .then(a => { setArtifact(a); setSelected(a.youtube.selected); })
      .catch(console.error);
  }, [epId]);

  const handleSelect = async (id: string) => {
    if (!epId) return;
    await selectCandidate(epId, id);
    setSelected(id);
  };

  if (!artifact) return <p>Loading prepare artifact…</p>;

  return (
    <div>
      <h1>Prepare — {epId}</h1>
      {selected && <p style={{ color: '#4caf50' }}>Selected: {selected}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {artifact.youtube.candidates.map((c: Candidate) => (
          <div key={c.id} style={{ border: `2px solid ${selected === c.id ? '#4caf50' : '#333'}`, borderRadius: 8, padding: 16, maxWidth: 340 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{c.id}</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>{c.rationale}</div>
            <div style={{ fontSize: 11, color: '#777', marginBottom: 12 }}>{c.tags.join(' · ')}</div>
            <button onClick={() => handleSelect(c.id)}
              style={{ padding: '6px 16px', cursor: 'pointer', background: selected === c.id ? '#4caf50' : '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>
              {selected === c.id ? 'Selected' : 'Select'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
