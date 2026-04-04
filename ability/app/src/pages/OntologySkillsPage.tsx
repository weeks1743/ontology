import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { Skill } from '../types';
import { Play, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function OntologySkillsPage() {
  const navigate = useNavigate();
  const { ontologyId } = useParams<{ ontologyId: string }>();
  const { skills, currentOntologyId, fetchSkills, generateOntologySkills, deleteAllOntologySkills, loading } = useAbilityStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const ontologySkills = skills.filter(s => s.category === 'ontology');

  const handleGenerate = async () => {
    if (!currentOntologyId) {
      alert('未选择本体系统');
      return;
    }
    await generateOntologySkills(currentOntologyId);
  };

  const handleDeleteAll = async () => {
    if (confirm('确定要删除所有本体技能吗？')) {
      await deleteAllOntologySkills();
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">本体技能</h1>
          <p className="text-sm text-white/40 mt-1">从本体模型中的逻辑行为自动生成的技能</p>
        </div>

        {/* 操作栏 */}
        <div className="flex gap-4">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            生成本体技能
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={loading || ontologySkills.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            全部删除
          </button>
        </div>

        {/* 技能卡片网格 */}
        {ontologySkills.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/40 mb-4">
              暂无本体技能，点击"生成本体技能"从主系统 behaviors 定义生成技能
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {ontologySkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onExecute={() => navigate(`/${ontologyId}/skills/${skill.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({ skill, onExecute }: { skill: Skill; onExecute: () => void }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-indigo-500/30 transition-colors cursor-pointer" onClick={onExecute}>
      <div className="text-4xl mb-3">{skill.metadata.emoji || '⚙️'}</div>
      <h3 className="text-lg font-semibold mb-2">{skill.name}</h3>
      <p className="text-sm text-white/40 mb-4 line-clamp-2">{skill.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-1 rounded bg-indigo-600/20 text-white">
          本体
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExecute();
          }}
          className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
        >
          <Play size={14} />
          试用
        </button>
      </div>
    </div>
  );
}