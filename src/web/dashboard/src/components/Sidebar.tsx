import React from 'react';
import { NavLink, useParams } from 'react-router-dom';

function EpisodePhases({ epId }: { epId: string }) {
  const links = [
    { to: `/episodes/${epId}/plan`, label: 'Plan' },
    { to: `/episodes/${epId}/audio`, label: 'Audio' },
    { to: `/episodes/${epId}/review`, label: 'Review' },
    { to: `/episodes/${epId}/prepare`, label: 'Prepare' },
    { to: `/episodes/${epId}/export`, label: 'Export' },
    { to: `/episodes/${epId}/hyperframes`, label: 'HyperFrames' },
  ];
  return (
    <>
      {links.map(l => (
        <NavLink key={l.to} to={l.to} style={({ isActive }) => ({ display: 'block', padding: '8px 16px', color: isActive ? '#fff' : '#aaa', textDecoration: 'none', background: isActive ? '#333' : 'transparent' })}>
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar() {
  const params = useParams<{ epId?: string }>();
  return (
    <nav style={{ width: 180, background: '#111', height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ padding: '16px', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #333' }}>ARS</div>
      <NavLink to="/episodes" style={({ isActive }) => ({ display: 'block', padding: '8px 16px', color: isActive ? '#fff' : '#aaa', textDecoration: 'none' })}>
        Episodes
      </NavLink>
      {params.epId && <EpisodePhases epId={params.epId} />}
    </nav>
  );
}
