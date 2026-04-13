import { useState } from 'react';
import { Play, CheckCircle, XCircle, AlertCircle, ExternalLink, Download, Loader2, Terminal } from 'lucide-react';

interface TestCase {
  id: string;
  // Support both old field names and new DB-style field names
  name?: string;
  case_name_zh?: string;
  description?: string;
  description_zh?: string;
  skillId?: string;
  skill_id?: string;
  params: any;
  expectedResult?: any;
  status: 'pending' | 'running' | 'passed' | 'failed';
  actualResult?: any;
  error?: string;
  duration?: number;
  htmlUrl?: string;
  htmlContent?: string;
  progress?: string;
  /** agent 模式：实时流式输出 */
  agentOutput?: string;
  /** agent 模式标识 */
  executionStyle?: 'api' | 'agent';
  /** agent 模式：传给 claude CLI 的完整 instruction */
  agentInstruction?: string;
  /** 输出格式类型 */
  outputFormat?: 'html' | 'markdown' | 'pptx';
  /** 输出文件 URL */
  outputFileUrl?: string;
  /** 输出文件内容 */
  outputFileContent?: string;
}

interface TestCaseRunnerProps {
  testCases: TestCase[];
  onRunTest: (testCase: any) => Promise<void>;
  onRunAll: () => Promise<void>;
}

export default function TestCaseRunner({ testCases, onRunTest, onRunAll }: TestCaseRunnerProps) {
  const [running, setRunning] = useState(false);

  const handleRunTest = async (testCase: TestCase) => {
    // 不要全局锁定，允许并行运行多个测试
    try {
      await onRunTest(testCase);
    } catch (error) {
      console.error('[TestCaseRunner] Test failed:', error);
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
    const format = testCase.outputFormat || 'html';
    const fileExtension = format === 'markdown' ? 'md' : format === 'pptx' ? 'pptx' : 'html';

    // 优先使用服务器持久化 URL 下载
    if (testCase.outputFileUrl && testCase.outputFileUrl.startsWith('/tmp/')) {
      // 直接通过服务器 URL 下载
      window.location.href = testCase.outputFileUrl;
      return;
    }

    // 兼容旧的 htmlUrl
    if (testCase.htmlUrl && testCase.htmlUrl.startsWith('/tmp/')) {
      window.location.href = testCase.htmlUrl;
      return;
    }

    // 降级：使用内容创建 blob（仅用于 HTML 和 Markdown）
    const content = testCase.outputFileContent || testCase.htmlContent;
    if (!content) {
      alert('文件内容为空，无法下载');
      return;
    }

    // PPTX 不支持 blob 下载
    if (format === 'pptx') {
      alert('PPTX 文件必须从服务器下载，请确保文件已生成');
      return;
    }

    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/html';

    try {
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${testCase.id}.${fileExtension}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('[Download] Failed:', error);
      alert('下载失败：' + (error as Error).message);
    }
  };

  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="text-green-400" size={20} />;
      case 'failed':
        return <XCircle className="text-red-400" size={20} />;
      case 'running':
        return <Loader2 className="text-indigo-400 animate-spin" size={20} />;
      default:
        return <AlertCircle className="text-gray-400" size={20} />;
    }
  };

  const passedCount = testCases.filter(tc => tc.status === 'passed').length;
  const failedCount = testCases.filter(tc => tc.status === 'failed').length;
  const runningCount = testCases.filter(tc => tc.status === 'running').length;
  const totalCount = testCases.length;

  return (
    <div className="space-y-6">
      {/* 统计和操作栏 */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
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
              <div className="text-2xl font-bold text-indigo-400">
                {totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0}%
              </div>
            </div>
          </div>

          <button
            onClick={handleRunAll}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play size={16} />
            {running ? `运行中 (${runningCount}/${totalCount})...` : '运行全部测试'}
          </button>
        </div>
      </div>

      {/* 测试用例列表 */}
      <div className="space-y-3">
        {testCases.map((testCase) => (
          <div
            key={testCase.id}
            className={`bg-white/5 border rounded-xl p-4 transition-colors ${
              testCase.status === 'running'
                ? 'border-indigo-500/30'
                : 'border-white/10 hover:border-indigo-500/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(testCase.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{testCase.id}</span>
                    <span className="text-sm text-gray-400">{testCase.name || testCase.case_name_zh}</span>
                    {/* Agent 模式标签已隐藏 */}
                    {/* {testCase.executionStyle === 'agent' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded text-xs">
                        <Terminal size={10} />
                        Agent
                      </span>
                    )} */}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{testCase.description || testCase.description_zh}</p>

                  {/* 运行中进度反馈 - 简洁静态方案 */}
                  {testCase.status === 'running' && (
                    <div className="mt-3 mb-2 flex items-center gap-2 text-sm text-indigo-400">
                      <Loader2 size={14} className="animate-spin" />
                      <span>{testCase.progress || '正在执行...'}</span>
                    </div>
                  )}

                  {/* Agent 流式输出（运行中实时显示，完成后保留） */}
                  {testCase.executionStyle === 'agent' && testCase.agentOutput && (
                    <details className="text-sm mt-2" open={testCase.status === 'running'}>
                      <summary className="cursor-pointer text-violet-400 hover:text-violet-300">
                        {testCase.status === 'running' ? '实时输出（流式）' : '查看 Agent 完整输出'}
                      </summary>
                      <pre className="mt-2 p-3 bg-black/40 border border-violet-500/20 rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap break-words font-mono leading-relaxed">
                        {testCase.agentOutput}
                      </pre>
                    </details>
                  )}

                  {/* 输入参数 / Agent 指令 */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-indigo-400 hover:text-indigo-300">
                      {testCase.executionStyle === 'agent' ? '查看指令' : '查看参数'}
                    </summary>
                    <pre className="mt-2 p-3 bg-black/30 rounded text-xs overflow-auto whitespace-pre-wrap break-words">
                      {testCase.executionStyle === 'agent'
                        ? (testCase.agentInstruction || '（未配置 agentInstruction）')
                        : JSON.stringify(testCase.params, null, 2)}
                    </pre>
                  </details>

                  {/* 测试结果 */}
                  {testCase.status === 'passed' && testCase.actualResult && (
                    <details className="text-sm mt-2">
                      <summary className="cursor-pointer text-green-400 hover:text-green-300">
                        查看结果
                      </summary>
                      <pre className="mt-2 p-3 bg-black/30 rounded text-xs overflow-auto max-h-96">
                        {typeof testCase.actualResult === 'object' && testCase.actualResult.format
                          ? JSON.stringify(testCase.actualResult, null, 2)
                          : JSON.stringify(testCase.actualResult, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* 文件输出操作 */}
                  {(testCase.outputFileUrl || testCase.outputFileContent || testCase.htmlUrl || testCase.htmlContent) && (
                    <div className="flex items-center gap-2 mt-2">
                      {/* HTML 格式：显示打开和下载按钮 */}
                      {testCase.outputFormat === 'html' && testCase.htmlUrl && (
                        <a
                          href={testCase.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm hover:bg-indigo-500/30 transition-colors"
                        >
                          <ExternalLink size={14} />
                          打开 HTML 报告
                        </a>
                      )}
                      {/* Markdown 格式：只显示下载按钮 */}
                      {testCase.outputFormat === 'markdown' && (
                        <button
                          onClick={() => handleDownload(testCase)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
                        >
                          <Download size={14} />
                          下载 Markdown
                        </button>
                      )}
                      {/* PPTX 格式：只显示下载按钮 */}
                      {testCase.outputFormat === 'pptx' && (
                        <button
                          onClick={() => handleDownload(testCase)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm hover:bg-orange-500/30 transition-colors"
                        >
                          <Download size={14} />
                          下载 PPTX
                        </button>
                      )}
                      {/* 兼容旧的 HTML 输出（没有指定 outputFormat） */}
                      {!testCase.outputFormat && testCase.htmlUrl && (
                        <a
                          href={testCase.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm hover:bg-indigo-500/30 transition-colors"
                        >
                          <ExternalLink size={14} />
                          打开 HTML 报告
                        </a>
                      )}
                      {!testCase.outputFormat && (testCase.htmlContent || testCase.outputFileContent) && (
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
                      耗时: {testCase.duration >= 1000 ? `${(testCase.duration / 1000).toFixed(1)}s` : `${testCase.duration}ms`}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRunTest(testCase)}
                disabled={testCase.status === 'running'}
                className="flex items-center gap-1 px-3 py-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
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
