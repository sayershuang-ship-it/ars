import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEpisodes, EpisodeEntry } from '../api';

export default function Episodes() {
  const [episodes, setEpisodes] = useState<EpisodeEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => { getEpisodes().then(setEpisodes).catch(console.error); }, []);

  return (
    <div>
      <h1>Episodes</h1>
      {episodes.length === 0 && <p style={{ color: '#888' }}>No episodes found.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {episodes.map(ep => (
          <li key={ep.epId} style={{ marginBottom: 8 }}>
            <button onClick={() => navigate(`/episodes/${ep.epId}/plan`)}
              style={{ padding: '10px 16px', cursor: 'pointer', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }}>
              {ep.epId} <span style={{ color: '#888', fontSize: 12 }}>({ep.series})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
