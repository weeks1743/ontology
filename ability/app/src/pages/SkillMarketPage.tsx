import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { Skill } from '../types';
import { Play, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SkillConfigDialog from '../components/SkillConfigDialog';

export default function SkillMarketPage() {
  const navigate = useNavigate();
  const { skills, fetchSkills, loading } = useAbilityStore();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  const externalSkills = skills.filter(s => s.category === 'external');

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
          <h1 className="text-3xl font-bold text-purple-400">技能市场</h1>
          <p className="text-gray-400 mt-2">外部通用技能库 — 来自第三方平台的可复用技能</p>
        </div>

        {/* 技能卡片网格 */}
        {externalSkills.length === 0 ? (
          <div className="glass-effect rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">
              暂无外部技能
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {externalSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onExecute={() => navigate(`/skills/${skill.id}`)}
                onConfig={() => handleConfigClick(skill)}
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

function SkillCard({ skill, onExecute, onConfig }: { skill: Skill; onExecute: () => void; onConfig: () => void }) {
  return (
    <div className="glass-effect rounded-lg p-6 hover:border-purple-500/30 transition-colors cursor-pointer" onClick={onExecute}>
      <div className="text-4xl mb-3">{skill.metadata.emoji || '⚙️'}</div>
      <h3 className="text-lg font-semibold mb-2">{skill.name}</h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{skill.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">
          外部
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfig();
            }}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
          >
            <Play size={14} />
            试用
          </button>
        </div>
      </div>
    </div>
  );
}
