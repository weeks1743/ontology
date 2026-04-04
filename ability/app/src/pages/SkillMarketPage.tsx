import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { Skill } from '../types';
import { Settings } from 'lucide-react';
import SkillConfigDialog from '../components/SkillConfigDialog';

export default function SkillMarketPage() {
  const { skills, fetchSkills, loading } = useAbilityStore();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

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
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">技能市场</h1>
          <p className="text-sm text-white/40 mt-1">外部通用技能库 — 来自第三方平台的可复用技能</p>
        </div>

        {/* 技能卡片网格 */}
        {externalSkills.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/40 mb-4">
              暂无外部技能
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {externalSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
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

function SkillCard({ skill, onConfig }: { skill: Skill; onConfig: () => void }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-indigo-500/30 transition-colors">
      <div className="text-4xl mb-3">{skill.metadata.emoji || '⚙️'}</div>
      <h3 className="text-lg font-semibold mb-2">{skill.name}</h3>
      <p className="text-sm text-white/40 mb-4 line-clamp-2">{skill.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-1 rounded bg-indigo-600/20 text-white">
          外部
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfig();
          }}
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
