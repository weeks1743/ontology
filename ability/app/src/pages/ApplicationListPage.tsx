import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAbilityStore } from '../store/ability-store';
import { Database } from 'lucide-react';

export default function ApplicationListPage() {
  const navigate = useNavigate();
  const { ontologies, loading, error, fetchOntologies } = useAbilityStore();

  useEffect(() => {
    fetchOntologies();
  }, [fetchOntologies]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-white/40">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-red-400">错误: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">选择应用系统</h1>
          <p className="text-sm text-white/40 mt-0.5">选择一个本体系统以查看和管理其技能</p>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ontologies.map((ontology) => (
              <div
                key={ontology.id}
                onClick={() => navigate(`/${ontology.id}/dashboard`)}
                className="group text-left bg-white/5 hover:bg-white/8 border border-white/10 hover:border-indigo-500/50 rounded-xl p-5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-600/30">
                    <Database className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                      {ontology.display_name}
                    </h3>
                    <p className="text-xs text-white/40">{ontology.ontology_code}</p>
                  </div>
                </div>

                {ontology.description && (
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{ontology.description}</p>
                )}

                <div className="text-xs text-white/30">
                  创建于: {new Date(ontology.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          {ontologies.length === 0 && (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">暂无本体系统</p>
              <p className="text-white/30 text-sm mt-2">请先在主系统创建本体</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
