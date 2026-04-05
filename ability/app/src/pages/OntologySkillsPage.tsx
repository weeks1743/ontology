import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { Skill, SkillBuild, BuildReport } from '../types';
import { Trash2, RefreshCw, Hammer, FileText, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import OntologySkillDetailDialog from '../components/OntologySkillDetailDialog';

export default function OntologySkillsPage() {
  const {
    skills, currentOntologyId, currentOntology, fetchSkills,
    deleteAllOntologySkills, loading, builds, currentBuildReport,
    triggerBuild, fetchBuilds, fetchBuildReport,
  } = useAbilityStore();

  const [showReport, setShowReport] = useState(false);
  const [expandedBuild, setExpandedBuild] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetchSkills();
    // Use ontology_code (e.g. "crm") not the numeric URL id
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (ontologyCode) {
      fetchBuilds(ontologyCode);
    }
  }, [fetchSkills, fetchBuilds, currentOntologyId, currentOntology]);

  const ontologySkills = skills.filter(s => s.category === 'ontology');
  const behaviorSkills = ontologySkills.filter(s => s.skill_type === 'behavior');
  const scenarioSkills = ontologySkills.filter(s => s.skill_type === 'scenario');
  const otherSkills = ontologySkills.filter(s => !s.skill_type || s.skill_type === 'query');

  const handleBuild = async (forceFull?: boolean) => {
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (!ontologyCode) {
      alert('未选择本体系统');
      return;
    }
    const result = await triggerBuild(ontologyCode, forceFull);
    if (result) {
      alert(`构建成功！版本 ${result.build_version}`);
    }
  };

  const handleDeleteAll = async () => {
    if (confirm('确定要删除所有本体技能吗？')) {
      await deleteAllOntologySkills();
    }
  };

  const handleViewReport = async (buildVersion: string) => {
    await fetchBuildReport(buildVersion);
    setShowReport(true);
  };

  const skillTypeBadge = (skill: Skill) => {
    if (skill.skill_type === 'behavior') return { label: '行为技能', color: 'bg-indigo-600/20 text-indigo-300' };
    if (skill.skill_type === 'scenario') return { label: '场景技能', color: 'bg-purple-600/20 text-purple-300' };
    if (skill.skill_type === 'query') return { label: '查询技能', color: 'bg-blue-600/20 text-blue-300' };
    return { label: '本体', color: 'bg-white/10 text-white' };
  };

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">本体技能</h1>
          <p className="text-sm text-white/40 mt-1">从本体快照动态编译生成的技能包</p>
        </div>

        {/* 操作栏 */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleBuild(false)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <Hammer size={16} />
            触发构建
          </button>
          <button
            onClick={() => handleBuild(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-800 hover:bg-indigo-700 border border-indigo-500/30 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            强制全量重建
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={loading || ontologySkills.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            全部删除
          </button>
        </div>

        {/* 构建历史 */}
        {builds.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide">构建历史</h2>
            <div className="space-y-2">
              {builds.map(build => (
                <BuildHistoryCard
                  key={build.id}
                  build={build}
                  expanded={expandedBuild === build.id}
                  onToggle={() => setExpandedBuild(expandedBuild === build.id ? null : build.id)}
                  onViewReport={() => handleViewReport(build.build_version)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 技能统计 */}
        {ontologySkills.length > 0 && (
          <div className="flex gap-4 text-sm">
            <span className="text-white/40">行为技能 <span className="text-white">{behaviorSkills.length}</span></span>
            <span className="text-white/40">场景技能 <span className="text-white">{scenarioSkills.length}</span></span>
            {otherSkills.length > 0 && (
              <span className="text-white/40">其他 <span className="text-white">{otherSkills.length}</span></span>
            )}
          </div>
        )}

        {/* 技能卡片网格 */}
        {ontologySkills.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/40 mb-4">
              暂无本体技能，点击「触发构建」从本体定义快照自动编译生成技能包
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {ontologySkills.map(skill => {
              const badge = skillTypeBadge(skill);
              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  badge={badge}
                  onClick={() => {
                    setSelectedSkill(skill);
                    setDetailDialogOpen(true);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 构建报告弹层 */}
      {showReport && currentBuildReport && (
        <BuildReportModal
          report={currentBuildReport}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 技能详情弹层 */}
      {selectedSkill && (
        <OntologySkillDetailDialog
          skill={selectedSkill}
          isOpen={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
        />
      )}
    </div>
  );
}

function BuildHistoryCard({
  build,
  expanded,
  onToggle,
  onViewReport,
}: {
  build: SkillBuild;
  expanded: boolean;
  onToggle: () => void;
  onViewReport: () => void;
}) {
  const statusIcon = build.status === 'success'
    ? <CheckCircle size={14} className="text-green-400" />
    : build.status === 'failed'
    ? <XCircle size={14} className="text-red-400" />
    : <Clock size={14} className="text-yellow-400" />;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
        onClick={onToggle}
      >
        {statusIcon}
        <span className="text-sm text-white font-mono">{build.build_version}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${build.build_mode === 'full' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'}`}>
          {build.build_mode === 'full' ? '全量' : '增量'}
        </span>
        <span className="text-xs text-white/40 ml-auto">{new Date(build.created_at).toLocaleString()}</span>
        <span className="text-xs text-white/40">生成 {build.generated_count} / 跳过 {build.skipped_count}</span>
        {expanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
      </div>

      {expanded && (
        <div className="px-4 pb-3 flex gap-3 border-t border-white/5 pt-3">
          <button
            onClick={onViewReport}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <FileText size={12} />
            查看报告
          </button>
        </div>
      )}
    </div>
  );
}

function SkillCard({
  skill,
  badge,
  onClick,
}: {
  skill: Skill;
  badge: { label: string; color: string };
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-indigo-500/30 transition-colors cursor-pointer"
    >
      <div className="text-3xl mb-3">{skill.metadata.emoji || '⚙️'}</div>
      <h3 className="text-base font-semibold mb-1">{skill.name}</h3>
      <p className="text-xs text-white/40 mb-4 line-clamp-2">{skill.description}</p>
      <div className="flex items-center">
        <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
          {badge.label}
        </span>
      </div>
    </div>
  );
}

function BuildReportModal({ report, onClose }: { report: BuildReport; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-[#13131A] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold">构建报告 - {report.build_version}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* 摘要 */}
          <Section title="构建摘要">
            <KV label="状态" value={report.summary.status} />
            <KV label="模式" value={report.summary.build_mode} />
            <KV label="耗时" value={`${report.summary.duration_ms}ms`} />
            <KV label="快照哈希" value={report.summary.snapshot_hash.slice(0, 16) + '...'} />
          </Section>

          {/* 输入快照 */}
          <Section title="输入快照">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <KV label="对象" value={report.input_snapshot.objects} />
              <KV label="行为" value={report.input_snapshot.behaviors} />
              <KV label="规则" value={report.input_snapshot.rules} />
              <KV label="事件" value={report.input_snapshot.events} />
              <KV label="场景" value={report.input_snapshot.scenarios} />
              <KV label="校验错误" value={report.input_snapshot.validation_errors} />
            </div>
          </Section>

          {/* 技能生成结果 */}
          <Section title="技能生成结果">
            <KV label="行为技能" value={report.skill_results.behavior_skills} />
            <KV label="场景技能" value={report.skill_results.scenario_skills} />
            <KV label="总计" value={report.skill_results.total} />
            {report.skill_results.new_skills.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-white/40 mb-1">新增技能</p>
                <div className="flex flex-wrap gap-1">
                  {report.skill_results.new_skills.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* 测试方案摘要 */}
          <Section title="测试方案">
            <KV label="总用例数" value={report.test_plan_summary.total_cases} />
            <KV label="正向用例" value={report.test_plan_summary.positive_cases} />
            <KV label="规则阻断用例" value={report.test_plan_summary.rule_block_cases} />
            <KV label="场景用例" value={report.test_plan_summary.scenario_cases} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-white/60 mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className="text-white">{String(value)}</span>
    </div>
  );
}
