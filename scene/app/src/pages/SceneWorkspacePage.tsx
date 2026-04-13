import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSceneStore } from '../store/scene-store';
import { IndustrySelectionModal } from '../components/scene/IndustrySelectionModal';
import { SceneConfigView } from '../components/scene/SceneConfigView';
import { CapabilityView } from '../components/capability/CapabilityView';

export function SceneWorkspacePage() {
  const { ontologyId } = useParams<{ ontologyId: string }>();
  const {
    currentOntology, activeNav, industries, selectedIndustry,
    showIndustryModal, setActiveNav, loadWorkspace, loading,
  } = useSceneStore();

  useEffect(() => {
    if (ontologyId) loadWorkspace(ontologyId);
  }, [ontologyId, loadWorkspace]);

  if (loading || !currentOntology) {
    return (
      <div className="h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-white/50">加载工作区中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-white overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-56 flex-shrink-0 flex flex-col bg-[#0E0E14] border-r border-white/8 h-screen">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-white/8 flex-shrink-0">
          <svg className="w-[18px] h-[18px] text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span className="text-white font-semibold text-sm">场景配置</span>
        </div>

        <div className="px-4 py-3 border-b border-white/8 flex-shrink-0">
          <div className="bg-white/5 rounded-xl p-3 flex items-center gap-2">
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentOntology.ontology_name}</p>
              <p className="text-[11px] text-white/40">{currentOntology.ontology_id}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <NavBtn label="场景配置" icon="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" active={activeNav === 'scene-config'} onClick={() => setActiveNav('scene-config')} />
          <NavBtn label="行业能力库" icon="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" active={activeNav === 'capability'} onClick={() => setActiveNav('capability')} />
        </nav>

        {selectedIndustry && (
          <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
            <button
              onClick={() => useSceneStore.getState().setShowIndustryModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 transition-colors text-xs"
            >
              <span>{selectedIndustry.icon}</span>
              <span className="text-white/60 flex-1 text-left truncate">{selectedIndustry.name}</span>
              <span className="text-white/25">切换</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-14 bg-[#0A0A0B] border-b border-white/10 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <a href="/" className="text-white/40 hover:text-white/70 transition-colors">场景配置</a>
            <span className="text-white/20">/</span>
            <span className="text-white/70">{currentOntology.ontology_name}</span>
          </div>
          <a href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">← 返回列表</a>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1100px] mx-auto p-8">
            {activeNav === 'scene-config' && <SceneConfigView />}
            {activeNav === 'capability' && <CapabilityView />}
          </div>
        </div>
      </div>

      {showIndustryModal && industries.length > 0 && <IndustrySelectionModal />}
    </div>
  );
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <div className="px-1 py-0.5 my-0.5">
      <button
        onClick={onClick}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left cursor-pointer transition-colors ${
          active ? 'bg-indigo-600/20 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        }`}
      >
        {active && <span className="w-0.5 h-5 bg-indigo-500 rounded-full absolute left-0" />}
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon}/>
        </svg>
        <span className="text-sm">{label}</span>
      </button>
    </div>
  );
}
