import { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

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
}

interface TestCaseRunnerProps {
  testCases: TestCase[];
  onRunTest: (testCase: TestCase) => Promise<void>;
  onRunAll: () => Promise<void>;
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
                      <pre className="mt-2 p-3 bg-black/30 rounded text-xs overflow-auto">
                        {JSON.stringify(testCase.actualResult, null, 2)}
                      </pre>
                    </details>
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
