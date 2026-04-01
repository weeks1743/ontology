import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useOntologyStore } from '../store/ontology-store';
import { api } from '../api';
import type { OntologyShell } from '../types/ontology';

import LeftSidebar from '../components/layout/LeftSidebar';
import TopHeader from '../components/layout/TopHeader';
import { RightPanel } from '../components/layout/RightPanel';

import TopologyWorkspace from '../components/workspaces/TopologyWorkspace';
import ObjectsWorkspace from '../components/workspaces/ObjectsWorkspace';
import BehaviorsWorkspace from '../components/workspaces/BehaviorsWorkspace';
import RulesWorkspace from '../components/workspaces/RulesWorkspace';
import EventsWorkspace from '../components/workspaces/EventsWorkspace';
import ScenariosWorkspace from '../components/workspaces/ScenariosWorkspace';
import YamlWorkspace from '../components/workspaces/YamlWorkspace';

import { Database } from 'lucide-react';

export default function CrmWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentOntology, activeTab, loadAll, rightPanelOpen } = useOntologyStore();

  const [ontology, setOntology] = useState<OntologyShell | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  const ontologyId = Number(id);

  useEffect(() => {
    if (!id || isNaN(ontologyId)) { setNotFound(true); return; }
    api.ontologies.get(ontologyId)
      .then((o) => {
        setOntology(o);
        setCurrentOntology(ontologyId);
        loadAll(ontologyId);
      })
      .catch(() => setNotFound(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api.seed(ontologyId);
      await loadAll(ontologyId);
      setSeedDone(true);
    } finally {
      setSeeding(false);
    }
  };

  if (notFound) return <Navigate to="/" replace />;
  if (!ontology) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-white/30 text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-white overflow-hidden">
      {/* Left sidebar */}
      <LeftSidebar
        ontology={ontology}
        onBackToList={() => navigate('/')}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header */}
        <TopHeader
          ontologyName={ontology.display_name}
          activeTab={activeTab}
          ontologyId={ontologyId}
        />

        {/* Workspace content */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'topology'   && <TopologyWorkspace  ontologyId={ontologyId} />}
          {activeTab === 'objects'    && <ObjectsWorkspace   ontologyId={ontologyId} />}
          {activeTab === 'behaviors'  && <BehaviorsWorkspace ontologyId={ontologyId} />}
          {activeTab === 'rules'      && <RulesWorkspace     ontologyId={ontologyId} />}
          {activeTab === 'events'     && <EventsWorkspace    ontologyId={ontologyId} />}
          {activeTab === 'scenarios'  && <ScenariosWorkspace ontologyId={ontologyId} />}
          {activeTab === 'yaml'       && <YamlWorkspace      ontologyId={ontologyId} />}

          {/* Seed data banner — shown when no data yet */}
          {activeTab === 'topology' && !seedDone && (
            <SeedBanner onSeed={handleSeed} seeding={seeding} />
          )}
        </div>
      </div>

      {/* Right detail panel */}
      {rightPanelOpen && <RightPanel ontologyId={ontologyId} />}
    </div>
  );
}

function SeedBanner({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  const { objects } = useOntologyStore();
  if (objects.length > 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-3 bg-[#1A1A2E] border border-indigo-500/30 rounded-xl px-5 py-3 shadow-xl">
        <Database size={16} className="text-indigo-400 flex-shrink-0" />
        <span className="text-sm text-white/70">暂无数据，一键导入 Lead → 商机 → 报价 示例数据</span>
        <button
          onClick={onSeed}
          disabled={seeding}
          className="ml-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {seeding ? '导入中...' : '导入示例数据'}
        </button>
      </div>
    </div>
  );
}
