import { useState, useEffect } from 'react';
import { skillsApi, ontologySkillsApi } from '../api/client';
import { useAbilityStore } from '../store/ability-store';
import TestCaseRunner from '../components/TestCaseRunner';
import { TestCase } from '../types';

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

  useEffect(() => {
    // Use ontology_code (e.g. "crm") not the numeric URL id
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (ontologyCode) {
      fetchBuilds(ontologyCode);
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
