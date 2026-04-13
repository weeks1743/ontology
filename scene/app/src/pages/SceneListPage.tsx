import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSceneStore } from '../store/scene-store';

export function SceneListPage() {
  const navigate = useNavigate();
  const { ontologies, loading, loadOntologies } = useSceneStore();

  useEffect(() => {
    loadOntologies();
  }, [loadOntologies]);

  if (loading) {
    return (
      <div className="h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-white/50">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header — aligns with ontology layer */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">场景配置</h1>
          <p className="text-sm text-white/40 mt-0.5">Scene Configuration</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10">
        {ontologies.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-12 text-center border border-white/5">
            <p className="text-white/40 mb-6">暂无本体配置</p>
            <button
              onClick={() => {
                fetch('/api/ontologies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ontology_id: 'crm', ontology_name: 'CRM客户关系管理' }),
                }).then(() => loadOntologies());
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              创建 CRM 本体
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ontologies.map((ontology) => (
              <button
                key={ontology.id}
                onClick={() => navigate(`/${ontology.ontology_id}`)}
                className="bg-white/5 rounded-xl p-6 text-left hover:bg-white/8 transition-all border border-white/5 hover:border-indigo-500/30 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500 transition-colors">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold truncate">{ontology.ontology_name}</h3>
                    <p className="text-xs text-white/30 font-mono">{ontology.ontology_id}</p>
                  </div>
                </div>
                <div className="text-xs text-white/30">
                  创建于 {new Date(ontology.created_at).toLocaleDateString('zh-CN')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
