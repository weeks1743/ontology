import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OntologyListPage from './pages/OntologyListPage';
import CreateOntologyPage from './pages/CreateOntologyPage';
import CrmWorkspacePage from './pages/CrmWorkspacePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OntologyListPage />} />
        <Route path="/ontologies/new" element={<CreateOntologyPage />} />
        <Route path="/ontologies/:id/*" element={<CrmWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
