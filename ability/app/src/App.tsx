import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ApplicationListPage from './pages/ApplicationListPage';
import DashboardPage from './pages/DashboardPage';
import OntologySkillsPage from './pages/OntologySkillsPage';
import SkillMarketPage from './pages/SkillMarketPage';
import SkillDetailPage from './pages/SkillDetailPage';
import SkillTestPage from './pages/SkillTestPage';
import ExternalSkillTestPage from './pages/ExternalSkillTestPage';
import ExecutionLogsPage from './pages/ExecutionLogsPage';
import OntologyLayout from './components/OntologyLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 应用选择首页 */}
        <Route path="/" element={<Navigate to="/applications" replace />} />
        <Route path="/applications" element={<ApplicationListPage />} />

        {/* 本体相关页面（带 ontologyId 参数） */}
        <Route path="/:ontologyId" element={<OntologyLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="ontology-skills" element={<OntologySkillsPage />} />
          <Route path="skills" element={<SkillMarketPage />} />
          <Route path="skills/:id" element={<SkillDetailPage />} />
          <Route path="test" element={<SkillTestPage />} />
          <Route path="test-external" element={<ExternalSkillTestPage />} />
          <Route path="logs" element={<ExecutionLogsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
