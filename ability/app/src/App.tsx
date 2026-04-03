import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import SkillMarketPage from './pages/SkillMarketPage';
import SkillDetailPage from './pages/SkillDetailPage';
import SkillTestPage from './pages/SkillTestPage';
import ExecutionLogsPage from './pages/ExecutionLogsPage';
import LeftSidebar from './components/LeftSidebar';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-space-darker overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 overflow-auto min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/skills" element={<SkillMarketPage />} />
            <Route path="/skills/:id" element={<SkillDetailPage />} />
            <Route path="/test" element={<SkillTestPage />} />
            <Route path="/logs" element={<ExecutionLogsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
