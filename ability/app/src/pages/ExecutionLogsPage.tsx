import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function ExecutionLogsPage() {
  const { logs, fetchLogs } = useAbilityStore();
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'partial'>('all');

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.status === filter);

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">执行历史</h1>
          <p className="text-sm text-white/40 mt-1">查看所有技能执行记录和状态</p>
        </div>

        {/* 过滤器 */}
        <div className="flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-indigo-600/20 text-white' : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            全部 ({logs.length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            成功 ({logs.filter(l => l.status === 'success').length})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            失败 ({logs.filter(l => l.status === 'error').length})
          </button>
        </div>

        {/* 日志表格 */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">状态</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">技能名称</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">时间</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">耗时</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">数据库状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    暂无执行记录
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-6 py-4">
                      {log.status === 'success' ? (
                        <CheckCircle className="text-green-400" size={20} />
                      ) : log.status === 'error' ? (
                        <XCircle className="text-red-400" size={20} />
                      ) : (
                        <AlertCircle className="text-yellow-400" size={20} />
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">{log.skill_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(log.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">{log.duration_ms}ms</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 text-xs">
                        <span className={`px-2 py-1 rounded ${getStatusColor(log.mongodb_status)}`}>
                          M: {log.mongodb_status}
                        </span>
                        <span className={`px-2 py-1 rounded ${getStatusColor(log.neo4j_status)}`}>
                          N: {log.neo4j_status}
                        </span>
                        <span className={`px-2 py-1 rounded ${getStatusColor(log.chroma_status)}`}>
                          C: {log.chroma_status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: 'ok' | 'error' | 'skipped') {
  switch (status) {
    case 'ok':
      return 'bg-green-500/20 text-green-400';
    case 'error':
      return 'bg-red-500/20 text-red-400';
    case 'skipped':
      return 'bg-gray-500/20 text-gray-400';
  }
}
