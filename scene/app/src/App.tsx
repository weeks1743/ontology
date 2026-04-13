import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SceneListPage } from './pages/SceneListPage';
import { SceneWorkspacePage } from './pages/SceneWorkspacePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SceneListPage />} />
        <Route path="/:ontologyId" element={<SceneWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
