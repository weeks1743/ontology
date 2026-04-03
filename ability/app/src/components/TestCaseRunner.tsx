import { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertCircle, ExternalLink, Download } from 'lucide-react';

interface TestCase {
  id: string;
  name: string;
  description: string;
  skillId: string;
  params: any;
  expectedResult?: any;
  status: 'pending' | 'running' | 'passed' | 'failed';
  actualResult?: any;
  error?: string;
  duration?: number;
  htmlUrl?: string;
  htmlContent?: string;
}

interface TestCaseRunnerProps {
  testCases: TestCase[];
  onRunTest: (testCase: TestCase) => Promise<void>;
  onRunAll: () => Promise<void>;
}

/**
 * 格式化测试结果（针对不同技能类型）
 */
function formatTestResult(result: any, skillId: string): React.ReactNode {
  // 网络搜索技能：显示摘要 + 统计
  if (skillId === 'ext.volcengine_web_search' || skillId === 'ext.baidu_search') {
    if (result.success) {
      const answer = result.answer || result.results?.[0]?.snippet || '';
      const answerPreview = answer.length > 200 ? answer.substring(0, 200) + '...' : answer;
      const refCount = result.references?.length || result.results?.length || 0;
      const toolUsage = result.usage?.tool_usage;

      return (
        <div className="space-y-2">
          <div className="text-green-400 font-semibold">✓ 搜索成功</div>
          {answer && (
            <div>
              <span className="text-gray-400">回答摘要：</span>
              <span className="text-gray-200 ml-2">{answerPreview}</span>
            </div>
          )}
          <div className="text-gray-400">
            引用来源：{refCount} 条
            {toolUsage && ` | 工具调用：${JSON.stringify(toolUsage)}`}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-400 text-xs">查看完整 JSON</summary>
            <pre className="mt-2 p-2 bg-black/50 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      );
    } else {
      return (
        <div className="text-red-400">
          <div className="font-semibold">✗ 搜索失败</div>
          <div>{result.error || '未知错误'}</div>
        </div>
      );
    }
  }

  // 报告生成技能：显示格式 + 长度
  if (skillId === 'ext.kai_report_creator') {
    if (typeof result === 'object' && result.format) {
      return (
        <div className="space-y-2">
          <div className="text-green-400 font-semibold">✓ 报告生成成功</div>
          <div className="text-gray-400">
            格式：{result.format} | 长度：{result.length} 字符
          </div>
          {result.preview && (
            <div className="text-gray-400 text-xs">
              预览：{result.preview.substring(0, 100)}...
            </div>
          )}
        </div>
      );
    }
  }

  // 本体技能（CRM）：显示简要摘要
  if (skillId.startsWith('ont.')) {
    if (result.success !== undefined) {
      return (
        <div className="space-y-2">
          <div className={result.success ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
            {result.success ? '✓ 执行成功' : '✗ 执行失败'}
          </div>
          {result.error && <div className="text-red-400">{result.error}</div>}
          {result.data && (
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-400 text-xs">查看数据</summary>
              <pre className="mt-2 p-2 bg-black/50 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      );
    }
  }

  // 默认：显示简化 JSON（限制深度）
  const simplified = JSON.stringify(result, null, 2);
  if (simplified.length > 500) {
    return (
      <div className="space-y-2">
        <div className="text-gray-400">结果过长（{simplified.length} 字符）</div>
        <details>
          <summary className="cursor-pointer text-blue-400 text-xs">查看完整结果</summary>
          <pre className="mt-2 p-2 bg-black/50 rounded text-xs overflow-auto max-h-96">
            {simplified}
          </pre>
        </details>
      </div>
    );
  }

  return <pre>{simplified}</pre>;
}

export default function TestCaseRunner({ testCases, onRunTest, onRunAll }: TestCaseRunnerProps) {
  const [running, setRunning] = useState(false);

  const handleRunTest = async (testCase: TestCase) => {
    setRunning(true);
    try {
      await onRunTest(testCase);
    } finally {
      setRunning(false);
    }
  };

  const handleRunAll = async () => {
    setRunning(true);
    try {
      await onRunAll();
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = (testCase: TestCase) => {
    if (!testCase.htmlContent) return;

    const blob = new Blob([testCase.htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${testCase.id}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="text-green-400" size={20} />;
      case 'failed':
        return <XCircle className="text-red-400" size={20} />;
      case 'running':
        return <Clock className="text-blue-400 animate-spin" size={20} />;
      default:
        return <AlertCircle className="text-gray-400" size={20} />;
    }
  };

  const passedCount = testCases.filter(tc => tc.status === 'passed').length;
  const failedCount = testCases.filter(tc => tc.status === 'failed').length;
  const totalCount = testCases.length;

  return (
    <div className="space-y-6">
      {/* 统计和操作栏 */}
      <div className="glass-effect rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <div>
              <div className="text-sm text-gray-400">总计</div>
              <div className="text-2xl font-bold">{totalCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">通过</div>
              <div className="text-2xl font-bold text-green-400">{passedCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">失败</div>
              <div className="text-2xl font-bold text-red-400">{failedCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">成功率</div>
              <div className="text-2xl font-bold text-blue-400">
                {totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0}%
              </div>
            </div>
          </div>

          <button
            onClick={handleRunAll}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play size={16} />
            {running ? '运行中...' : '运行全部测试'}
          </button>
        </div>
      </div>

      {/* 测试用例列表 */}
      <div className="space-y-3">
        {testCases.map((testCase) => (
          <div
            key={testCase.id}
            className="glass-effect rounded-lg p-4 hover:border-blue-500/30 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(testCase.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{testCase.id}</span>
                    <span className="text-sm text-gray-400">{testCase.name}</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{testCase.description}</p>

                  {/* 输入参数 */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                      查看参数
                    </summary>
                    <pre className="mt-2 p-3 bg-black/30 rounded text-xs overflow-auto">
                      {JSON.stringify(testCase.params, null, 2)}
                    </pre>
                  </details>

                  {/* 测试结果 */}
                  {testCase.status === 'passed' && testCase.actualResult && (
                    <details className="text-sm mt-2">
                      <summary className="cursor-pointer text-green-400 hover:text-green-300">
                        查看结果
                      </summary>
                      <div className="mt-2 p-3 bg-black/30 rounded text-xs overflow-auto">
                        {formatTestResult(testCase.actualResult, testCase.skillId)}
                      </div>
                    </details>
                  )}

                  {/* HTML 报告操作 */}
                  {(testCase.htmlUrl || testCase.htmlContent) && (
                    <div className="flex items-center gap-2 mt-2">
                      {testCase.htmlUrl && (
                        <a
                          href={testCase.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
                        >
                          <ExternalLink size={14} />
                          打开 HTML 报告
                        </a>
                      )}
                      {testCase.htmlContent && (
                        <button
                          onClick={() => handleDownload(testCase)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                        >
                          <Download size={14} />
                          下载 HTML
                        </button>
                      )}
                    </div>
                  )}

                  {/* 错误信息 */}
                  {testCase.status === 'failed' && testCase.error && (
                    <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                      {testCase.error}
                    </div>
                  )}

                  {/* 执行时间 */}
                  {testCase.duration !== undefined && (
                    <div className="mt-2 text-xs text-gray-500">
                      耗时: {testCase.duration}ms
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRunTest(testCase)}
                disabled={running || testCase.status === 'running'}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                <Play size={14} />
                运行
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
