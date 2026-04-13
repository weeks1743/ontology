import { useState, useEffect, useMemo } from 'react';
import { useSceneStore } from '../../store/scene-store';
import type { Scenario, ExternalSkill } from '../../api/client';
import { sectionApi, behaviorApi, bindingApi } from '../../api/client';

const SCENARIO_META: Record<string, { tag: string; tagColor: string }> = {
  IT_ASSESSMENT:       { tag: '方案呈现', tagColor: '#3B82F6' },
  COMPETITOR_ANALYSIS: { tag: '市场洞察', tagColor: '#8B5CF6' },
  RENEWAL_ASSESSMENT:  { tag: '客户维系', tagColor: '#10B981' },
  DEPT_PRESENTATION:  { tag: '科室推介', tagColor: '#10B981' },
  CONFERENCE_REPORT:  { tag: '学术推广', tagColor: '#06B6D4' },
  INSURANCE_ACCESS:   { tag: '医保准入', tagColor: '#F59E0B' },
  SUPPLY_OPTIMIZATION:{ tag: '供应链', tagColor: '#F59E0B' },
  PRODUCT_LAUNCH:     { tag: '新品上市', tagColor: '#EF4444' },
  QUALITY_SYSTEM:     { tag: '品控体系', tagColor: '#14B8A6' },
};

/** Ontology ID to use for behavior lookup (IT 行业 → crm 本体) */
const INDUSTRY_ONTOLOGY_MAP: Record<string, string> = {
  IT: 'crm',
};

/* ── IT_ASSESSMENT pipeline template (no behavior data, just structure) ── */
const IT_ASSESSMENT_PIPELINE = {
  input: {
    label: '信息收集',
    items: [
      { label: '拜访记录', sublabel: '录音转写文本' },
      { label: '客户背景', sublabel: '企业基本信息' },
      { label: '历史往来', sublabel: '过往合作记录' },
    ],
  },
  analysis: {
    label: '分析模块',
    modules: [
      { sectionCode: 'INFO_STATUS',    label: '信息化现状分析' },
      { sectionCode: 'INFO_OUTPUT',    label: '信息化产出分析' },
      { sectionCode: 'INFO_RECOMMEND', label: '信息化升级建议' },
    ],
  },
  output: {
    label: '评估报告生成',
    deliverables: ['信息化现状评估', '差距分析矩阵', '升级路线图'],
  },
};

/* ── Industry enhancement for IT Enterprise Software ── */
const IT_ENTERPRISE_INDUSTRY = {
  industryName: 'IT 企业软件',
  terminology: ['金蝶', '云之家', '固定资产', '财务', '台账', '接口', 'OA', '二维码'],
  analysisDimensions: [
    { label: '资产治理成熟度',     desc: '账实一致性、历史资产处理、编码规范' },
    { label: '财务与业务承接分层', desc: '财务主账与业务动作职责清晰、接口通顺' },
    { label: '运维与安全韧性',     desc: '补丁、漏洞、停服、审批中断和交接机制' },
  ],
  patterns: ['账实不符', '财务割裂', '运维薄弱'],
};

interface Section { id: number; code: string; name: string; description: string | null; }
interface SectionWithBinding { section: Section; bindings: import('../../api/client').SkillBinding[]; }

interface BehaviorItem {
  skill_id: string;
  behavior_code: string;
  behavior_name_zh: string;
  owner_object: string;
  trigger_type: string;
  description: string;
}

/* ── Pipeline detail modal for IT_ASSESSMENT (three-step: select-ontology → select-external → view) ── */
function AssessmentDetailModal({
  scenario,
  enrichedSections,
  industryColor,
  ontologyId,
  onClose,
  onSkillSelect,
}: {
  scenario: Scenario;
  enrichedSections: SectionWithBinding[];
  industryColor: string;
  ontologyId: string;
  onClose: () => void;
  onSkillSelect?: (ontology: BehaviorItem, external: ExternalSkill) => void;
}) {
  const meta = SCENARIO_META[scenario.code];

  // Derive already-bound skills from DB bindings
  const { boundOntology, boundExternal } = useMemo(() => {
    const allBindings = enrichedSections.flatMap(s => s.bindings);
    const ontBinding = allBindings.find(b => b.is_active === 1 && b.skill_id.startsWith('ont.'));
    const extBinding = allBindings.find(b => b.is_active === 1 && b.skill_id.startsWith('ext.'));
    return {
      boundOntology: ontBinding ? {
        skill_id: ontBinding.skill_id,
        behavior_code: '',
        behavior_name_zh: ontBinding.skill_name,
        owner_object: ontBinding.skill_id.split('.').slice(0, 2).join('.'),
        trigger_type: 'PERCEPTIVE',
        description: '',
      } as BehaviorItem : null,
      boundExternal: extBinding ? {
        id: extBinding.skill_id,
        name: extBinding.skill_name,
        display_name: extBinding.skill_name,
        description: '',
        category: 'external',
        metadata: {},
      } as ExternalSkill : null,
    };
  }, [enrichedSections]);

  const hasBinding = enrichedSections.some(s => s.bindings.length > 0);
  const [step, setStep] = useState<'select' | 'select-external' | 'pipeline'>(
    hasBinding && boundOntology && boundExternal ? 'pipeline' : 'select'
  );
  const [behaviors, setBehaviors] = useState<BehaviorItem[]>([]);
  const [externals, setExternals] = useState<ExternalSkill[]>([]);
  const [userSelectedBehavior, setUserSelectedBehavior] = useState<BehaviorItem | null>(null);
  const [userSelectedExternal, setUserSelectedExternal] = useState<ExternalSkill | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedBehavior = userSelectedBehavior ?? boundOntology;
  const selectedExternal = userSelectedExternal ?? boundExternal;

  useEffect(() => {
    (async () => {
      try {
        const [bhList, extList] = await Promise.all([
          behaviorApi.listLogical(ontologyId).catch(() => []),
          behaviorApi.listExternal().catch(() => []),
        ]);
        setBehaviors(bhList);
        setExternals(extList);
      } catch { setBehaviors([]); setExternals([]); }
      finally { setLoading(false); }
    })();
  }, [ontologyId]);

  const handleSelectBehavior = (behavior: BehaviorItem) => {
    setUserSelectedBehavior(behavior);
    setStep('select-external');
  };

  const handleSelectExternal = (skill: ExternalSkill) => {
    setUserSelectedExternal(skill);
    onSkillSelect?.(selectedBehavior!, skill);
    setStep('pipeline');
  };

  const handleSkipExternal = () => {
    onSkillSelect?.(selectedBehavior!, selectedExternal!);
    setStep('pipeline');
  };

  const sortedSections = [...enrichedSections].sort(
    (a, b) => (a.section as any).display_order - (b.section as any).display_order,
  );

  const pipeline = IT_ASSESSMENT_PIPELINE;
  const ind = IT_ENTERPRISE_INDUSTRY;

  // ── Step 1: Ontology behavior selector ──
  if (step === 'select') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-[560px] max-w-[90vw] max-h-[80vh] bg-[#16161D] rounded-2xl border border-white/10 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{scenario.name}</h3>
                <p className="text-sm text-white/40 mt-1">{scenario.description}</p>
              </div>
              <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-white/70">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px] font-bold">1</span>
                本体行为
              </span>
              <span className="text-white/15">—</span>
              <span className="flex items-center gap-1 text-xs text-white/30">
                <span className="w-5 h-5 rounded-full bg-white/5 text-white/30 flex items-center justify-center text-[10px] font-bold">2</span>
                外部技能
              </span>
            </div>
            <div className="mt-2 text-xs text-white/40">
              请选择一个本体层<strong className="text-white/70">逻辑行为（感知型）</strong>作为场景的数据分析引擎
            </div>
          </div>

          {/* Behavior list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <p className="text-white/30 text-sm text-center py-8">加载可用行为…</p>
            ) : behaviors.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">暂无可用逻辑行为</p>
            ) : (
              behaviors.map((b) => (
                <button
                  key={b.skill_id}
                  onClick={() => handleSelectBehavior(b)}
                  className="w-full text-left rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-indigo-500/30 hover:bg-indigo-500/[0.04] transition-all group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-base">⚡</span>
                    <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
                      {b.behavior_name_zh}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300/70 font-mono">
                      {b.behavior_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-8 text-[11px] text-white/35">
                    <span className="font-mono">{b.skill_id}</span>
                    <span className="font-mono">{b.owner_object}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: External skill selector ──
  if (step === 'select-external') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-[560px] max-w-[90vw] max-h-[80vh] bg-[#16161D] rounded-2xl border border-white/10 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{scenario.name}</h3>
                <p className="text-sm text-white/40 mt-1">{scenario.description}</p>
              </div>
              <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-indigo-300">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px] font-bold">1</span>
                {selectedBehavior?.behavior_name_zh}
              </span>
              <span className="text-white/15">—</span>
              <span className="flex items-center gap-1 text-xs text-white/70">
                <span className="w-5 h-5 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center text-[10px] font-bold">2</span>
                外部技能
              </span>
            </div>
            <div className="mt-2 text-xs text-white/40">
              选择一个<strong className="text-white/70">外部技能</strong>增强场景能力，或跳过此步
            </div>
          </div>

          {/* External skill list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <p className="text-white/30 text-sm text-center py-8">加载外部技能…</p>
            ) : externals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/30 text-sm mb-4">暂无可用外部技能</p>
                <button
                  onClick={handleSkipExternal}
                  className="text-xs px-4 py-2 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
                >
                  跳过，仅使用本体行为
                </button>
              </div>
            ) : (
              <>
                {externals.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectExternal(s)}
                    className="w-full text-left rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-amber-500/30 hover:bg-amber-500/[0.04] transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-base">{s.metadata?.emoji || '🔧'}</span>
                      <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
                        {s.display_name || s.name}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 ml-8 line-clamp-2">{s.description}</p>
                    {s.metadata?.when_to_use && (
                      <p className="text-[11px] text-amber-300/50 ml-8 mt-1">{s.metadata.when_to_use}</p>
                    )}
                  </button>
                ))}
                <button
                  onClick={handleSkipExternal}
                  className="w-full text-center rounded-xl border border-dashed border-white/10 p-3 text-xs text-white/25 hover:text-white/40 hover:border-white/20 transition-colors"
                >
                  跳过，仅使用本体行为
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Pipeline view with both skills ──
  const bh = selectedBehavior!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[800px] max-w-[92vw] max-h-[85vh] bg-[#16161D] rounded-2xl border border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-white">{scenario.name}</h3>
              {meta && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: `${meta.tagColor}15`, color: meta.tagColor }}
                >
                  {meta.tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('select')}
                className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors"
              >
                ← 重新选择
              </button>
              <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-white/40 mt-1">{scenario.description}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── Skill combo bar: ontology + external ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ontology behavior */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px] font-bold">1</span>
                <span className="text-sm font-medium text-indigo-300">本体行为</span>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">⚡</span>
                <span className="text-sm font-semibold text-white/90">{bh.behavior_name_zh}</span>
                <span className="text-[11px] text-white/25 font-mono">{bh.behavior_code}</span>
              </div>
              <p className="text-xs text-white/50 mb-2 line-clamp-2">
                {bh.description || `基于本体层 ${bh.owner_object} 的逻辑行为`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300/80">{bh.owner_object}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300/80">
                  {bh.trigger_type === 'PERCEPTIVE' ? '感知型' : bh.trigger_type}
                </span>
              </div>
            </div>

            {/* External skill */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center text-[10px] font-bold">2</span>
                <span className="text-sm font-medium text-amber-300">外部技能</span>
              </div>
              {selectedExternal ? (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{selectedExternal.metadata?.emoji || '🔧'}</span>
                    <span className="text-sm font-semibold text-white/90">{selectedExternal.display_name || selectedExternal.name}</span>
                  </div>
                  <p className="text-xs text-white/50 mb-2 line-clamp-2">{selectedExternal.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300/80 font-mono">{selectedExternal.id}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">未选择外部技能</span>
                  <button
                    onClick={() => setStep('select-external')}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                  >
                    + 添加
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Pipeline: Input → Analysis → Output ── */}
          <div className="flex items-stretch gap-3">
            {/* Input column */}
            <div className="w-[25%] flex-shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📥</span>
                <span className="text-xs font-semibold text-blue-300">输入 · {pipeline.input.label}</span>
              </div>
              <div className="space-y-2.5">
                {pipeline.input.items.map((item) => (
                  <div key={item.label} className="rounded-lg bg-blue-500/[0.08] px-3 py-2">
                    <div className="text-xs font-medium text-white/80">{item.label}</div>
                    <div className="text-[11px] text-white/35">{item.sublabel}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center flex-shrink-0">
              <svg className="w-5 h-5 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>

            {/* Analysis column */}
            <div className="flex-1 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🔍</span>
                <span className="text-xs font-semibold text-white/70">分析模块</span>
              </div>
              <div className="space-y-2.5">
                {pipeline.analysis.modules.map((mod, i) => {
                  const enriched = sortedSections.find((s) => s.section.code === mod.sectionCode);
                  const sec = enriched?.section;
                  const ontBinding = enriched?.bindings.find(b => b.is_active === 1 && b.skill_id.startsWith('ont.'));
                  const extBinding = enriched?.bindings.find(b => b.is_active === 1 && b.skill_id.startsWith('ext.'));
                  return (
                    <div key={mod.sectionCode} className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{ backgroundColor: `${industryColor}20`, color: industryColor }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-xs font-semibold text-white/80">{mod.label}</span>
                        {ontBinding && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300/70 font-mono truncate max-w-[120px]">
                            {ontBinding.skill_name}
                          </span>
                        )}
                        {extBinding && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300/70 font-mono truncate max-w-[120px]">
                            {extBinding.skill_name}
                          </span>
                        )}
                      </div>
                      {sec?.description && (
                        <p className="text-[11px] text-white/35 leading-relaxed ml-7">{sec.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center flex-shrink-0">
              <svg className="w-5 h-5 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>

            {/* Output column */}
            <div className="w-[25%] flex-shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📤</span>
                <span className="text-xs font-semibold text-emerald-300">输出 · {pipeline.output.label}</span>
              </div>
              <div className="space-y-2.5">
                {pipeline.output.deliverables.map((d) => (
                  <div key={d} className="rounded-lg bg-emerald-500/[0.08] px-3 py-2">
                    <div className="text-xs font-medium text-white/80">{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Industry enhancement footer ── */}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🏭</span>
              <span className="text-xs font-semibold text-amber-300">{ind.industryName} · 行业增强</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-white/40 mb-2 font-medium">分析维度</div>
                <div className="space-y-1.5">
                  {ind.analysisDimensions.map((dim) => (
                    <div key={dim.label} className="flex items-start gap-2">
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300/80 font-medium whitespace-nowrap mt-0.5">
                        {dim.label}
                      </span>
                      <span className="text-[11px] text-white/35 leading-relaxed">{dim.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-white/40 mb-2 font-medium">行业术语</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ind.terminology.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-white/50">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-white/40 mb-2 font-medium">常见模式</div>
                <div className="flex flex-wrap gap-1.5">
                  {ind.patterns.map((p) => (
                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-300/70">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main view ── */
export function SceneConfigView() {
  const { selectedIndustry, currentOntology, scenarios } = useSceneStore();
  const [detailScenario, setDetailScenario] = useState<Scenario | null>(null);
  const [enrichedSections, setEnrichedSections] = useState<SectionWithBinding[]>([]);
  // Track bound skills per scenario: scenarioId → { ont, ext }
  const [scenarioBindings, setScenarioBindings] = useState<Record<number, {
    ont: { skill_id: string; skill_name: string } | null;
    ext: { skill_id: string; skill_name: string } | null;
  }>>({});

  // Pre-load binding state for all scenario cards on mount / scenario change
  useEffect(() => {
    if (scenarios.length === 0) return;
    let cancelled = false;
    (async () => {
      const map: Record<number, { ont: { skill_id: string; skill_name: string } | null; ext: { skill_id: string; skill_name: string } | null }> = {};
      await Promise.all(scenarios.map(async (sc) => {
        try {
          const secs = await sectionApi.list(sc.id);
          for (const sec of secs as Section[]) {
            try {
              const bindings = await bindingApi.list(sec.id);
              const activeBindings = bindings.filter(b => b.is_active === 1);
              if (activeBindings.length > 0 && !map[sc.id]) {
                const ont = activeBindings.find(b => b.skill_id.startsWith('ont.'));
                const ext = activeBindings.find(b => b.skill_id.startsWith('ext.'));
                map[sc.id] = {
                  ont: ont ? { skill_id: ont.skill_id, skill_name: ont.skill_name } : null,
                  ext: ext ? { skill_id: ext.skill_id, skill_name: ext.skill_name } : null,
                };
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }));
      if (!cancelled) setScenarioBindings(prev => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [scenarios]);

  const openDetail = async (scenario: Scenario) => {
    setDetailScenario(scenario);
    try {
      const secs = await sectionApi.list(scenario.id);
      // Fetch bindings for each section
      const withBindings = await Promise.all(
        (secs as Section[]).map(async (sec) => {
          try {
            const bindings = await bindingApi.list(sec.id);
            return { section: sec, bindings };
          } catch {
            return { section: sec, bindings: [] };
          }
        })
      );
      setEnrichedSections(withBindings);

      // Cache the bindings for this scenario card
      const allBindings = withBindings.flatMap(s => s.bindings).filter(b => b.is_active === 1);
      const ont = allBindings.find(b => b.skill_id.startsWith('ont.'));
      const ext = allBindings.find(b => b.skill_id.startsWith('ext.'));
      if (ont || ext) {
        setScenarioBindings(prev => ({
          ...prev,
          [scenario.id]: {
            ont: ont ? { skill_id: ont.skill_id, skill_name: ont.skill_name } : null,
            ext: ext ? { skill_id: ext.skill_id, skill_name: ext.skill_name } : null,
          },
        }));
      }
    } catch { setEnrichedSections([]); }
  };

  // Callback: called after user selects both ontology behavior and external skill
  const handleBindingChange = async (
    scenarioId: number,
    ontology: { skill_id: string; skill_name: string },
    external: { skill_id: string; skill_name: string } | null,
  ) => {
    // 1. Update card state immediately
    setScenarioBindings(prev => ({
      ...prev,
      [scenarioId]: { ont: ontology, ext: external },
    }));

    // 2. Persist bindings to DB for every analysis-module section
    for (const es of enrichedSections) {
      const ontExisting = es.bindings.find(b => b.is_active === 1 && b.skill_id.startsWith('ont.'));
      if (ontExisting) {
        await bindingApi.update(ontExisting.id, { skill_id: ontology.skill_id, skill_name: ontology.skill_name });
      } else {
        await bindingApi.create(es.section.id, { skill_id: ontology.skill_id, skill_name: ontology.skill_name, is_active: 1 });
      }

      if (external) {
        const extExisting = es.bindings.find(b => b.is_active === 1 && b.skill_id.startsWith('ext.'));
        if (extExisting) {
          await bindingApi.update(extExisting.id, { skill_id: external.skill_id, skill_name: external.skill_name });
        } else {
          await bindingApi.create(es.section.id, { skill_id: external.skill_id, skill_name: external.skill_name, is_active: 1 });
        }
      }
    }

    // 3. Refresh enrichedSections so the UI reflects new binding data
    try {
      const secs = await sectionApi.list(scenarioId);
      const refreshed = await Promise.all(
        (secs as Section[]).map(async (sec) => {
          try {
            const bindings = await bindingApi.list(sec.id);
            return { section: sec, bindings };
          } catch {
            return { section: sec, bindings: [] as import('../../api/client').SkillBinding[] };
          }
        })
      );
      setEnrichedSections(refreshed);
    } catch { /* leave stale sections */ }
  };

  if (!selectedIndustry) {
    return <div className="text-center py-20"><p className="text-white/30">请先选择行业</p></div>;
  }

  const industryColor = selectedIndustry.color ?? '#3B82F6';
  // Use the industry code to map to ontology ID for behavior lookup
  const ontologyIdForBehavior = INDUSTRY_ONTOLOGY_MAP[selectedIndustry.code] ?? currentOntology?.ontology_id ?? '';

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-1">场景配置</h2>
        <p className="text-sm text-white/40">
          {selectedIndustry.icon} {selectedIndustry.name} · 共 {scenarios.length} 个销售场景
        </p>
      </div>

      {scenarios.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-10 text-center border border-white/5">
          <p className="text-white/30">暂无场景</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenarios.map((scenario) => {
            const meta = SCENARIO_META[scenario.code];
            const bound = scenarioBindings[scenario.id];
            return (
              <button
                key={scenario.id}
                onClick={() => openDetail(scenario)}
                className="group rounded-2xl border border-white/8 p-5 text-left hover:border-indigo-500/30 hover:bg-white/[0.03] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  {meta && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                      style={{ backgroundColor: `${meta.tagColor}15`, color: meta.tagColor }}
                    >
                      {meta.tag}
                    </span>
                  )}
                  <svg className="w-4 h-4 text-white/15 group-hover:text-indigo-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white/90 mb-1.5 group-hover:text-white transition-colors">
                  {scenario.name}
                </h3>
                <p className="text-xs text-white/40 leading-relaxed line-clamp-3">
                  {scenario.description}
                </p>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-white/25">{scenario.code}</span>
                  <div className="flex items-center gap-1.5">
                    {bound?.ont && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300/70 font-mono truncate max-w-[120px]">
                        ⚡ {bound.ont.skill_name}
                      </span>
                    )}
                    {bound?.ext && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300/70 font-mono truncate max-w-[120px]">
                        🔧 {bound.ext.skill_name}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailScenario && (
        detailScenario.code === 'IT_ASSESSMENT' ? (
          <AssessmentDetailModal
            scenario={detailScenario}
            enrichedSections={enrichedSections}
            industryColor={industryColor}
            ontologyId={ontologyIdForBehavior}
            onClose={() => setDetailScenario(null)}
            onSkillSelect={(bh, ext) => handleBindingChange(
              detailScenario!.id,
              { skill_id: bh.skill_id, skill_name: bh.behavior_name_zh },
              ext ? { skill_id: ext.id.startsWith('ext.') ? ext.id : `ext.${ext.id}`, skill_name: ext.display_name || ext.name } : null,
            )}
          />
        ) : (
          /* Default flat section list for other scenarios */
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailScenario(null)} />
            <div className="relative w-[640px] max-w-[90vw] max-h-[80vh] bg-[#16161D] rounded-2xl border border-white/10 shadow-2xl flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-white/8 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{detailScenario.name}</h3>
                    <p className="text-sm text-white/40 mt-1">{detailScenario.description}</p>
                  </div>
                  <button onClick={() => setDetailScenario(null)} className="text-white/30 hover:text-white/60 transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="mt-3 text-[11px] text-white/25 font-mono">{detailScenario.code}</div>
              </div>
              {/* Sections */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {enrichedSections.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-8">暂无内容模块</p>
                ) : (
                  enrichedSections
                    .sort((a, b) => (a.section as any).display_order - (b.section as any).display_order)
                    .map(({ section: sec }, i) => (
                      <div key={sec.id} className="rounded-xl border border-white/8 p-5 bg-white/[0.02]">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: `${industryColor}20`, color: industryColor }}
                          >
                            {i + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-white/90">{sec.name}</h4>
                        </div>
                        {sec.description && (
                          <p className="text-xs text-white/40 leading-relaxed ml-10">{sec.description}</p>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
