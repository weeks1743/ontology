import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOntologyStore } from '../store/ontology-store';
import { Plus, Database, ChevronRight } from 'lucide-react';

export default function OntologyListPage() {
  const { ontologies, loadOntologies } = useOntologyStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadOntologies();
  }, [loadOntologies]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">本体管理</h1>
          <p className="text-sm text-white/40 mt-0.5">Ontology Management System</p>
        </div>
        <button
          onClick={() => navigate('/ontologies/new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          新建本体
        </button>
      </div>

      {/* Content */}
      <div className="px-8 py-8">
        {ontologies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/30">
            <Database size={48} className="mb-4 opacity-30" />
            <p className="text-lg">还没有本体</p>
            <p className="text-sm mt-1">点击「新建本体」开始</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ontologies.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate(`/ontologies/${o.id}`)}
                className="group text-left bg-white/5 hover:bg-white/8 border border-white/10 hover:border-indigo-500/50 rounded-xl p-5 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                        CRM
                      </span>
                    </div>
                    <h3 className="font-semibold text-white truncate">{o.display_name}</h3>
                    <p className="text-xs font-mono text-white/40 mt-0.5">{o.ontology_code}</p>
                    {o.description && (
                      <p className="text-sm text-white/50 mt-2 line-clamp-2">{o.description}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-white/20 group-hover:text-white/60 mt-1 flex-shrink-0 transition-colors" />
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 text-xs text-white/30">
                  创建于 {new Date(o.created_at).toLocaleDateString('zh-CN')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
