import { useState, useEffect } from 'react';
import { skillsApi, ontologySkillsApi } from '../api/client';
import { useAbilityStore } from '../store/ability-store';
import TestCaseRunner from '../components/TestCaseRunner';
import { Skill, TestCase } from '../types';

type AdviceStep = {
  step: number;
  title: string;
  defaultMarkdown: string;
  uploadedMarkdown?: string;
  visitRecordId?: string;
  analysis?: {
    summary: string;
    sentiment: string;
    key_signals: string[];
  };
  advice?: {
    round_no: number;
    current_assessment: string;
    evidence_summary: string;
    recommended_actions: string[];
    change_since_last_round: string;
    advice_markdown_url?: string;
    advice_html_url?: string;
  };
  running?: boolean;
  error?: string;
};

const MOCK_CUSTOMER = {
  id: 'cust_mock_001',
  name: '华东智造集团',
  industry: '制造业',
  region: '华东',
};

const INITIAL_ADVICE_STEPS: AdviceStep[] = [
  {
    step: 1,
    title: '第一次拜访：初步接触',
    defaultMarkdown: `# 第一次拜访纪要

## 客户背景
- 客户为多工厂制造企业，正在梳理集团级协同系统

## 客户关注点
- 希望统一跨工厂协同流程
- 希望销售、交付、售后数据能打通

## 主要异议
- 当前需求仍比较宽泛，内部还没形成统一需求清单

## 下一步承诺
- 下周组织业务和 IT 负责人一起做需求梳理会`,
  },
  {
    step: 2,
    title: '第二次拜访：异议显性化',
    defaultMarkdown: `# 第二次拜访纪要

## 客户关注点
- 关注项目实施周期和跨系统集成成本
- 关注权限模型是否能满足总部审计要求

## 主要异议
- 预算需要总部批准，当前还没有完全锁定
- 客户提到竞品已经在推更短实施周期方案

## 风险信号
- 客户表示如果试点周期过长，项目优先级可能会下降

## 下一步承诺
- 两周内给出试点范围和关键接口清单`,
  },
  {
    step: 3,
    title: '第三次拜访：推进窗口出现',
    defaultMarkdown: `# 第三次拜访纪要

## 客户关注点
- 希望尽快看到试点项目排期和资源投入方案
- 希望高层能看到阶段性 ROI

## 主要异议
- 仍担心上线后现场使用阻力

## 风险信号
- 客户要求在本月内完成内部立项评审，否则预算可能延后

## 下一步承诺
- 客户同意安排一次管理层汇报会
- 如果方案可行，将启动试点立项`,
  },
];

// 本体技能用新 manifest-driven API
async function executeOntologySkill(skillId: string, params: any) {
  try {
    const res = await fetch(`/api/ontology-skills/${encodeURIComponent(skillId)}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await res.json();
    return {
      success: result.success,
      spawnOutput: result.data,
      error: result.error,
      durationMs: result.duration_ms,
    };
  } catch {
    // Fallback to old API
    const result = await skillsApi.execute(skillId, params);
    return {
      success: result.success,
      spawnOutput: result.data,
      error: result.error,
      durationMs: result.duration_ms,
    };
  }
}

type RuntimeTestCase = TestCase & {
  status: 'pending' | 'running' | 'passed' | 'failed';
  actualResult?: any;
  error?: string;
  duration?: number;
  htmlUrl?: string;
  htmlContent?: string;
  progress?: string;
};

export default function SkillTestPage() {
  const { currentOntologyId, currentOntology, builds, fetchBuilds } = useAbilityStore();

  const [selectedBuildVersion, setSelectedBuildVersion] = useState<string>('');
  const [ontologyTests, setOntologyTests] = useState<RuntimeTestCase[]>([]);
  const [loadingTestPlan, setLoadingTestPlan] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);
  const [adviceSteps, setAdviceSteps] = useState<AdviceStep[]>(INITIAL_ADVICE_STEPS);
  const [ontologySkillMap, setOntologySkillMap] = useState<Record<string, string>>({});

  const updateAdviceStep = (stepNo: number, patch: Partial<AdviceStep>) => {
    setAdviceSteps(prev => prev.map(step => step.step === stepNo ? { ...step, ...patch } : step));
  };

  const loadMarkdownFile = async (stepNo: number, file: File) => {
    const content = await file.text();
    updateAdviceStep(stepNo, { uploadedMarkdown: content, error: undefined });
  };

  const runAdviceRound = async (step: AdviceStep) => {
    const createSkillId = ontologySkillMap['visit_record_create_from_markdown'] || ontologySkillMap['visitrecord_create_from_markdown'];
    const analyzeSkillId = ontologySkillMap['visit_record_analyze'] || ontologySkillMap['visitrecord_analyze'];
    const adviceSkillId = ontologySkillMap['customer_generate_operating_advice'];

    if (!createSkillId || !analyzeSkillId || !adviceSkillId) {
      updateAdviceStep(step.step, {
        running: false,
        error: '当前构建版本还没有经营建议相关技能。请先重新 Seed CRM 本体并重新 Build 本体技能。',
      });
      return;
    }

    const contentMarkdown = step.uploadedMarkdown || step.defaultMarkdown;
    updateAdviceStep(step.step, { running: true, error: undefined });

    try {
      const createResult = await ontologySkillsApi.executeSkill(createSkillId, {
        customer_id: MOCK_CUSTOMER.id,
        customer_name: MOCK_CUSTOMER.name,
        title: step.title,
        sequence_no: step.step,
        visit_type: 'uploaded_markdown',
        content_markdown: contentMarkdown,
        visit_at: `2026-04-0${step.step + 8}`,
        source_channel: 'uploaded_markdown',
        industry: MOCK_CUSTOMER.industry,
        region: MOCK_CUSTOMER.region,
      });
      if (!createResult.success) throw new Error(createResult.error || '创建拜访记录失败');

      const visitRecordId = createResult.data?.visit_record_id;
      const analyzeResult = await ontologySkillsApi.executeSkill(analyzeSkillId, {
        visit_record_id: visitRecordId,
      });
      if (!analyzeResult.success) throw new Error(analyzeResult.error || '分析拜访记录失败');

      const visitRecordIds = adviceSteps
        .filter(item => item.step <= step.step)
        .map(item => item.visitRecordId)
        .filter(Boolean) as string[];
      if (visitRecordId && !visitRecordIds.includes(visitRecordId)) visitRecordIds.push(visitRecordId);

      const adviceResult = await ontologySkillsApi.executeSkill(adviceSkillId, {
        customer_id: MOCK_CUSTOMER.id,
        visit_record_ids: visitRecordIds,
        advice_round: step.step,
      });
      if (!adviceResult.success) throw new Error(adviceResult.error || '生成客户经营建议失败');

      updateAdviceStep(step.step, {
        running: false,
        visitRecordId,
        analysis: analyzeResult.data,
        advice: adviceResult.data,
      });
    } catch (error) {
      updateAdviceStep(step.step, {
        running: false,
        error: (error as Error).message,
      });
    }
  };

  useEffect(() => {
    // Use ontology_code (e.g. "crm") not the numeric URL id
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (ontologyCode) {
      fetchBuilds(ontologyCode);
      skillsApi.getAll(ontologyCode)
        .then((skills: Skill[]) => {
          const nextMap: Record<string, string> = {};
          for (const skill of skills) {
            if (skill.category !== 'ontology') continue;
            if (skill.skill_slug) nextMap[skill.skill_slug] = skill.id;
          }
          setOntologySkillMap(nextMap);
        })
        .catch(() => setOntologySkillMap({}));
    }
  }, [currentOntologyId, currentOntology, fetchBuilds]);

  // Auto-select latest build version
  useEffect(() => {
    if (builds.length > 0 && !selectedBuildVersion) {
      setSelectedBuildVersion(builds[0].build_version);
    }
  }, [builds, selectedBuildVersion]);

  // Load test plan when build version changes
  useEffect(() => {
    if (!selectedBuildVersion) return;

    setLoadingTestPlan(true);
    ontologySkillsApi.getTestPlan(selectedBuildVersion)
      .then(plan => {
        if (plan?.cases) {
          setOntologyTests(plan.cases.map((tc: TestCase) => ({ ...tc, status: 'pending' as const })));
        }
      })
      .catch(() => {
        setOntologyTests([]);
      })
      .finally(() => setLoadingTestPlan(false));
  }, [selectedBuildVersion]);

  const runTest = async (testCase: RuntimeTestCase) => {
    const runId = testCase.id;

    const updateTc = (patch: Partial<RuntimeTestCase>) => {
      setOntologyTests(tests => tests.map(tc => tc.id === runId ? { ...tc, ...patch } : tc));
    };

    updateTc({ status: 'running', htmlUrl: undefined, htmlContent: undefined, progress: '正在执行...', duration: undefined });

    const startTime = Date.now();
    const timerRef = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      updateTc({ progress: `正在执行... (${elapsed}s)` });
    }, 1000);

    try {
      const result = await executeOntologySkill(testCase.skill_id, testCase.params);
      const duration = Date.now() - startTime;
      clearInterval(timerRef);

      // Determine pass/fail based on expected_result
      // rule_block cases expect success=false, so raw success is not the right indicator
      const expectedSuccess = testCase.expected_result?.success;
      const testPassed = expectedSuccess !== undefined
        ? (result.success === expectedSuccess)
        : result.success;

      const output = result.spawnOutput;
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

      updateTc({
        status: testPassed ? 'passed' : 'failed',
        actualResult: output ? { format: 'text', length: outputStr.length, preview: outputStr.substring(0, 500) } : undefined,
        error: result.error,
        duration,
        progress: undefined,
      });
    } catch (error) {
      clearInterval(timerRef);
      updateTc({
        status: 'failed',
        error: (error as Error).message,
        duration: Date.now() - startTime,
        progress: undefined,
      });
    }
  };

  const runAllTests = async () => {
    for (const testCase of ontologyTests) {
      await runTest(testCase);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  const caseTypeCounts = {
    positive: ontologyTests.filter(t => t.case_type === 'positive').length,
    rule_block: ontologyTests.filter(t => t.case_type === 'rule_block').length,
    scenario: ontologyTests.filter(t => t.case_type === 'scenario').length,
  };

  const handleClearData = async () => {
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (!ontologyCode) return;

    setClearing(true);
    setClearResult(null);
    try {
      const result = await ontologySkillsApi.clearData(ontologyCode);
      setClearResult(result);
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Clear data error:', error);
      alert('清空数据失败: ' + (error as Error).message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">本体技能测试</h1>
            <p className="text-sm text-white/40 mt-1">运行测试用例验证本体技能功能</p>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            清空数据
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">客户经营建议交互过程</h2>
            <p className="text-sm text-white/45 mt-1">
              以同一客户的三次拜访记录为证据，逐轮触发【客户经营建议】本体技能，观察建议如何随时间演进。
            </p>
            {(!(ontologySkillMap['visit_record_create_from_markdown'] || ontologySkillMap['visitrecord_create_from_markdown']) || !ontologySkillMap['customer_generate_operating_advice']) && (
              <p className="text-xs text-amber-300/80 mt-2">
                当前未发现经营建议相关技能，请先重新 Seed CRM 本体并重新 Build 本体技能。
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Mock Customer</p>
                <h3 className="text-white font-medium mt-2">{MOCK_CUSTOMER.name}</h3>
                <p className="text-sm text-white/50 mt-1">{MOCK_CUSTOMER.industry} / {MOCK_CUSTOMER.region}</p>
              </div>

              {adviceSteps.map(step => (
                <div key={step.step} className="rounded-xl border border-white/10 bg-[#111214] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">记录 {step.step}</p>
                      <h3 className="text-white font-medium mt-1">{step.title}</h3>
                    </div>
                    <button
                      onClick={() => runAdviceRound(step)}
                      disabled={step.running}
                      className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 text-sm"
                    >
                      {step.running ? '执行中...' : `生成第 ${step.step} 轮建议`}
                    </button>
                  </div>

                  <label className="block text-sm text-white/60">
                    上传 Markdown 记录
                    <input
                      type="file"
                      accept=".md,text/markdown"
                      className="mt-2 block w-full text-xs text-white/50"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void loadMarkdownFile(step.step, file);
                      }}
                    />
                  </label>

                  <div className="rounded-lg bg-black/20 border border-white/5 p-3">
                    <p className="text-xs text-white/35 mb-2">当前记录内容</p>
                    <pre className="text-xs text-white/70 whitespace-pre-wrap overflow-auto max-h-56">
                      {step.uploadedMarkdown || step.defaultMarkdown}
                    </pre>
                  </div>

                  {step.analysis && (
                    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3 space-y-2">
                      <p className="text-sm text-white/80">记录摘要：{step.analysis.summary}</p>
                      <p className="text-xs text-white/45">客户态度：{step.analysis.sentiment}</p>
                      <div className="flex flex-wrap gap-2">
                        {step.analysis.key_signals?.map(signal => (
                          <span key={signal} className="px-2 py-1 rounded-full bg-white/5 text-[11px] text-white/60">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                      {step.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {adviceSteps.map(step => (
                <div key={`advice-${step.step}`} className="rounded-xl border border-white/10 bg-[#111214] p-4 space-y-3 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">第 {step.step} 轮建议</p>
                      <h3 className="text-white font-medium mt-1">建议演进结果</h3>
                    </div>
                    {step.advice?.advice_html_url && (
                      <a
                        href={step.advice.advice_html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        打开 HTML
                      </a>
                    )}
                  </div>

                  {!step.advice && (
                    <div className="text-sm text-white/35 pt-8">执行该轮后，这里会出现本轮客户经营建议与相较上一轮的变化。</div>
                  )}

                  {step.advice && (
                    <>
                      <p className="text-sm text-white/85">{step.advice.current_assessment}</p>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/35 mb-2">建议动作</p>
                        <div className="space-y-2">
                          {step.advice.recommended_actions?.map(action => (
                            <div key={action} className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-100">
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/35 mb-2">建议依据</p>
                        <pre className="text-xs text-white/60 whitespace-pre-wrap overflow-auto max-h-36">
                          {step.advice.evidence_summary}
                        </pre>
                      </div>
                      <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                        相比上一轮变化：{step.advice.change_since_last_round}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-white/45">
                        {step.advice.advice_markdown_url && (
                          <a href={step.advice.advice_markdown_url} target="_blank" rel="noreferrer" className="hover:text-white/70">
                            查看 Markdown
                          </a>
                        )}
                        {step.advice.advice_html_url && (
                          <a href={step.advice.advice_html_url} target="_blank" rel="noreferrer" className="hover:text-white/70">
                            查看 HTML
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 构建版本选择 */}
        <div className="flex items-center gap-4">
          <label className="text-sm text-white/60">构建版本</label>
          <select
            value={selectedBuildVersion}
            onChange={e => setSelectedBuildVersion(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">-- 选择版本 --</option>
            {builds.map(b => (
              <option key={b.id} value={b.build_version}>{b.build_version} ({b.status})</option>
            ))}
          </select>
          {loadingTestPlan && <span className="text-sm text-white/40">加载中...</span>}
          {ontologyTests.length > 0 && (
            <div className="flex gap-3 text-xs text-white/40">
              <span>正向 {caseTypeCounts.positive}</span>
              <span>规则阻断 {caseTypeCounts.rule_block}</span>
              <span>场景 {caseTypeCounts.scenario}</span>
            </div>
          )}
        </div>

        {/* 测试用例运行器 */}
        <TestCaseRunner
          testCases={ontologyTests}
          onRunTest={runTest}
          onRunAll={runAllTests}
        />
      </div>

      {/* 清空数据确认对话框 */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1B] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">确认清空数据</h3>
            <p className="text-sm text-white/60 mb-4">
              将清空本体 <span className="text-white font-medium">{currentOntology?.ontology_code || currentOntologyId}</span> 在 MongoDB、Neo4j、ChromaDB 中的所有数据。
            </p>
            <p className="text-sm text-red-400 mb-6">此操作不可恢复，确定继续吗？</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm disabled:opacity-50"
              >
                {clearing ? '清空中...' : '确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清空结果提示 */}
      {clearResult && (
        <div className="fixed bottom-4 right-4 bg-[#1A1A1B] border border-white/10 rounded-xl p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">数据已清空</p>
              <div className="text-xs text-white/50 mt-1 space-y-0.5">
                <p>MongoDB: {clearResult.cleared.mongodb.documents_deleted} 条文档</p>
                <p>Neo4j: {clearResult.cleared.neo4j.nodes_deleted} 个节点, {clearResult.cleared.neo4j.relationships_deleted} 条关系</p>
                <p>ChromaDB: {clearResult.cleared.chroma.documents_deleted} 条向量</p>
              </div>
            </div>
            <button
              onClick={() => setClearResult(null)}
              className="text-white/40 hover:text-white/60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
