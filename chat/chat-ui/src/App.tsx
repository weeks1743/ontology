import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OntologyListPage from './pages/OntologyListPage';
import ChatWorkspace from './pages/ChatWorkspace';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/ontologies" replace />} />
        <Route path="/ontologies" element={<OntologyListPage />} />
        <Route path="/chat/:ontologyId" element={<ChatWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
