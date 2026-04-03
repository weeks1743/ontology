import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { skillsApi } from '../api/client';
import { Skill, ExecutionResult } from '../types';
import { Play, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function SkillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [inputParams, setInputParams] = useState('{}');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (id) {
      skillsApi.getById(id).then(setSkill);
    }
  }, [id]);

  const handleExecute = async () => {
    if (!id) return;

    setExecuting(true);
    setResult(null);

    try {
      const params = JSON.parse(inputParams);
      const res = await skillsApi.execute(id, params);
      setResult(res);
    } catch (error) {
      setResult({
        success: false,
        error: (error as Error).message,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: 0,
      });
    } finally {
      setExecuting(false);
    }
  };

  if (!skill) {
    return <div className="h-full overflow-auto bg-space-darker p-8">加载中...</div>;
  }

  return (
    <div className="h-full overflow-auto bg-space-darker">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{skill.metadata.emoji || '⚙️'}</span>
          <div>
            <h1 className="text-3xl font-bold text-blue-400">{skill.name}</h1>
            <p className="text-gray-400 mt-2">{skill.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 输入参数 */}
          <div className="glass-effect rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">输入参数</h2>
            <textarea
              value={inputParams}
              onChange={(e) => setInputParams(e.target.value)}
              className="w-full h-64 bg-black/30 border border-glass-border rounded-lg p-4 font-mono text-sm resize-none focus:border-blue-500/50 focus:outline-none"
              placeholder='{"key": "value"}'
            />
            <button
              onClick={handleExecute}
              disabled={executing}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <Play size={16} />
              {executing ? '执行中...' : '执行技能'}
            </button>
          </div>

          {/* 执行结果 */}
          <div className="glass-effect rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">执行结果</h2>
            {result ? (
              <div className="space-y-4">
                {/* 状态 */}
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-red-400" size={20} />
                  )}
                  <span className="font-semibold">
                    {result.success ? '执行成功' : '执行失败'}
                  </span>
                </div>

                {/* 数据库状态 */}
                <div className="space-y-2">
                  <DatabaseStatus label="MongoDB" status={result.mongodb_status} />
                  <DatabaseStatus label="Neo4j" status={result.neo4j_status} />
                  <DatabaseStatus label="ChromaDB" status={result.chroma_status} />
                </div>

                {/* 耗时 */}
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock size={16} />
                  <span className="font-mono">耗时: {result.duration_ms}ms</span>
                </div>

                {/* 结果数据 */}
                <div className="bg-black/30 border border-glass-border rounded-lg p-4 max-h-64 overflow-auto">
                  <pre className="text-sm font-mono">
                    {JSON.stringify(result.data || result.error, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 py-8 text-center">等待执行...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabaseStatus({ label, status }: { label: string; status: 'ok' | 'error' | 'skipped' }) {
  const icons = {
    ok: <CheckCircle className="text-green-400" size={16} />,
    error: <XCircle className="text-red-400" size={16} />,
    skipped: <Clock className="text-gray-400" size={16} />,
  };

  const labels = {
    ok: '成功',
    error: '失败',
    skipped: '跳过',
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {icons[status]}
      <span>{label}: {labels[status]}</span>
    </div>
  );
}
