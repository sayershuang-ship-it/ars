import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import ProgressStream from '../components/ProgressStream';
import YoutubeStatus from '../components/YoutubeStatus';

export default function Export() {
  const { epId } = useParams<{ epId: string }>();
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [publishing, setPublishing] = useState(false);

  return (
    <div>
      <h1>Export — {epId}</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>1. Render</h2>
        <p style={{ color: '#888', fontSize: 13 }}>Runs Remotion render to produce the MP4.</p>
        <button onClick={() => setRendering(true)} disabled={rendering}
          style={{ padding: '10px 20px', cursor: rendering ? 'not-allowed' : 'pointer', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4 }}>
          {rendering ? 'Rendering…' : 'Render Video'}
        </button>
        {rendering && (
          <div style={{ marginTop: 12 }}>
            <ProgressStream
              url={`/api/episodes/${epId}/render`}
              body={{}}
              onComplete={() => { setRendering(false); setRendered(true); }}
            />
          </div>
        )}
        {rendered && (
          <div style={{ marginTop: 12 }}>
            <a href={`/api/episodes/${epId}/download`}
              style={{ padding: '8px 16px', background: '#2e7d32', color: '#fff', borderRadius: 4, textDecoration: 'none' }}>
              Download MP4
            </a>
          </div>
        )}
      </section>

      <section>
        <h2>2. Upload to YouTube</h2>
        <div style={{ marginBottom: 16 }}>
          <YoutubeStatus />
        </div>
        <button onClick={() => setPublishing(true)} disabled={publishing}
          style={{ padding: '10px 20px', cursor: publishing ? 'not-allowed' : 'pointer', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4 }}>
          {publishing ? 'Uploading…' : 'Upload to YouTube'}
        </button>
        {publishing && (
          <div style={{ marginTop: 12 }}>
            <ProgressStream
              url={`/api/episodes/${epId}/publish`}
              body={{ privacy: 'private' }}
              onComplete={() => setPublishing(false)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
