import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { Skill } from '../types';
import { Play, Trash2, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SkillConfigDialog from '../components/SkillConfigDialog';

export default function SkillMarketPage() {
  const navigate = useNavigate();
  const { skills, fetchSkills, generateOntologySkills, deleteAllOntologySkills, loading } = useAbilityStore();
  const [activeTab, setActiveTab] = useState<'ontology' | 'external'>('ontology');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  const ontologySkills = skills.filter(s => s.category === 'ontology');
  const externalSkills = skills.filter(s => s.category === 'external');
  const displaySkills = activeTab === 'ontology' ? ontologySkills : externalSkills;

  const handleGenerate = async () => {
    // TODO: 需要从主系统获取 ontology_id
    // 这里暂时硬编码一个 ID
    await generateOntologySkills('crm-v1');
  };

  const handleDeleteAll = async () => {
    if (confirm('确定要删除所有本体技能吗？')) {
      await deleteAllOntologySkills();
    }
  };

  const handleConfigClick = (skill: Skill) => {
    setSelectedSkill(skill);
    setConfigDialogOpen(true);
  };

  const handleConfigSave = () => {
    // 配置保存后刷新技能列表
    fetchSkills();
  };

  return (
    <div className="h-full overflow-auto bg-space-darker">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">技能市场</h1>
          <p className="text-gray-400 mt-2">管理和执行所有可用技能</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('ontology')}
            className={`px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'ontology'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'glass-effect text-gray-300 hover:bg-white/5'
            }`}
          >
            本体技能 ({ontologySkills.length})
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'external'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'glass-effect text-gray-300 hover:bg-white/5'
            }`}
          >
            外部技能 ({externalSkills.length})
          </button>
        </div>

        {/* 本体技能操作栏 */}
        {activeTab === 'ontology' && (
          <div className="flex gap-4">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
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
        )}

        {/* 技能卡片网格 */}
        {displaySkills.length === 0 ? (
          <div className="glass-effect rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">
              {activeTab === 'ontology'
                ? '暂无本体技能，点击"生成本体技能"从主系统 behaviors 定义生成技能'
                : '暂无外部技能'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {displaySkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onExecute={() => navigate(`/skills/${skill.id}`)}
                onConfig={activeTab === 'external' ? () => handleConfigClick(skill) : undefined}
              />
            ))}
          </div>
        )}

        {/* 配置对话框 */}
        {selectedSkill && (
          <SkillConfigDialog
            skillId={selectedSkill.id}
            skillName={selectedSkill.name}
            isOpen={configDialogOpen}
            onClose={() => setConfigDialogOpen(false)}
            onSave={handleConfigSave}
          />
        )}
      </div>
    </div>
  );
}

function SkillCard({ skill, onExecute, onConfig }: { skill: Skill; onExecute: () => void; onConfig?: () => void }) {
  return (
    <div className="glass-effect rounded-lg p-6 hover:border-blue-500/30 transition-colors cursor-pointer" onClick={onExecute}>
      <div className="text-4xl mb-3">{skill.metadata.emoji || '⚙️'}</div>
      <h3 className="text-lg font-semibold mb-2">{skill.name}</h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{skill.description}</p>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-1 rounded ${
          skill.category === 'ontology' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
        }`}>
          {skill.category === 'ontology' ? '本体' : '外部'}
        </span>
        <div className="flex items-center gap-2">
          {onConfig && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfig();
              }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300"
            >
              <Settings size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            <Play size={14} />
            试用
          </button>
        </div>
      </div>
    </div>
  );
}
