import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ProgressStream from '../components/ProgressStream';
import { getHfHtml, saveHfHtml } from '../api';

export default function HyperFrames() {
  const { epId } = useParams<{ epId: string }>();
  const [html, setHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog] = useState('');
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!epId) return;
    getHfHtml(epId).then(r => setHtml(r.html)).catch(() => {/* not generated yet */});
  }, [epId]);

  const handleGenerate = async () => {
    if (!epId) return;
    setGenerating(true);
    setGenLog('Calling Claude to generate HyperFrames HTML…');
    try {
      const res = await fetch(`/api/episodes/${epId}/hyperframes/generate`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const { html: generated } = await res.json();
      setHtml(generated);
      setGenLog('Generated');
    } catch (e) {
      setGenLog(`Error: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!epId) return;
    await saveHfHtml(epId, html);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1>HyperFrames — {epId}</h1>
      <p style={{ color: '#888', fontSize: 13 }}>
        Parallel render track: HTML composition generated from episode source, rendered to MP4 via HyperFrames.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2>1. Generate HTML</h2>
        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: '10px 20px', cursor: generating ? 'not-allowed' : 'pointer', background: '#5c35a8', color: '#fff', border: 'none', borderRadius: 4, marginRight: 8 }}>
          {generating ? 'Generating…' : html ? 'Regenerate' : 'Generate from Episode'}
        </button>
        {genLog && <span style={{ color: '#aaa', fontSize: 13 }}>{genLog}</span>}
      </section>

      {html && (
        <section style={{ marginBottom: 24 }}>
          <h2>2. Edit HTML (optional)</h2>
          <textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            style={{ width: '100%', height: 300, fontFamily: 'monospace', fontSize: 12, background: '#111', color: '#eee', border: '1px solid #333', padding: 12, borderRadius: 4, boxSizing: 'border-box' }}
          />
          <button onClick={handleSave}
            style={{ marginTop: 8, padding: '6px 16px', cursor: 'pointer', background: saved ? '#4caf50' : '#333', color: '#fff', border: '1px solid #555', borderRadius: 4 }}>
            {saved ? 'Saved' : 'Save Edits'}
          </button>
        </section>
      )}

      {html && (
        <section style={{ marginBottom: 24 }}>
          <h2>3. Render MP4</h2>
          <p style={{ color: '#888', fontSize: 13 }}>Requires FFmpeg. Runs <code>npx hyperframes render</code>.</p>
          <button onClick={() => setRendering(true)} disabled={rendering}
            style={{ padding: '10px 20px', cursor: rendering ? 'not-allowed' : 'pointer', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4 }}>
            {rendering ? 'Rendering…' : 'Render Video'}
          </button>
          {rendering && (
            <div style={{ marginTop: 12 }}>
              <ProgressStream
                url={`/api/episodes/${epId}/hyperframes/render`}
                body={{}}
                onComplete={() => { setRendering(false); setRendered(true); }}
              />
            </div>
          )}
          {rendered && (
            <div style={{ marginTop: 12 }}>
              <a href={`/api/episodes/${epId}/hyperframes/download`}
                style={{ padding: '8px 16px', background: '#2e7d32', color: '#fff', borderRadius: 4, textDecoration: 'none' }}>
                Download HyperFrames MP4
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
