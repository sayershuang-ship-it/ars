import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import ProgressStream from '../components/ProgressStream';

export default function Audio() {
  const { epId } = useParams<{ epId: string }>();
  const [streaming, setStreaming] = useState(false);

  return (
    <div>
      <h1>Audio — {epId}</h1>
      <p style={{ color: '#888' }}>Generates TTS audio for all steps via MiniMax.</p>
      <button onClick={() => setStreaming(true)} disabled={streaming}
        style={{ padding: '10px 20px', cursor: streaming ? 'not-allowed' : 'pointer', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, marginBottom: 16 }}>
        {streaming ? 'Generating…' : 'Generate All Audio'}
      </button>
      {streaming && (
        <ProgressStream
          url={`/api/episodes/${epId}/audio`}
          body={{}}
          onComplete={() => setStreaming(false)}
        />
      )}
    </div>
  );
}
