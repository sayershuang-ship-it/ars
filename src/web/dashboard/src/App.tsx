import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Episodes from './pages/Episodes';
import Plan from './pages/Plan';
import Audio from './pages/Audio';
import Review from './pages/Review';
import Prepare from './pages/Prepare';
import Export from './pages/Export';

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/episodes" replace />} />
          <Route path="/episodes" element={<Episodes />} />
          <Route path="/episodes/:epId/plan" element={<Plan />} />
          <Route path="/episodes/:epId/audio" element={<Audio />} />
          <Route path="/episodes/:epId/review" element={<Review />} />
          <Route path="/episodes/:epId/prepare" element={<Prepare />} />
          <Route path="/episodes/:epId/export" element={<Export />} />
        </Routes>
      </main>
    </div>
  );
}
