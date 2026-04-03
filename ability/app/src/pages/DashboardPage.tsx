import { useEffect } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { Activity, CheckCircle, XCircle, Database, Zap, TrendingUp, Target } from 'lucide-react';

export default function DashboardPage() {
  const { skills, logs, databaseStatus, fetchSkills, fetchLogs, fetchDatabaseStatus } = useAbilityStore();

  useEffect(() => {
    fetchSkills();
    fetchLogs({ limit: 5 });
    fetchDatabaseStatus();
  }, []);

  const ontologySkills = skills.filter(s => s.category === 'ontology');
  const externalSkills = skills.filter(s => s.category === 'external');
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.created_at).toDateString();
    const today = new Date().toDateString();
    return logDate === today;
  });
  const successRate = logs.length > 0
    ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100)
    : 0;

  return (
    <div className="h-full overflow-auto bg-space-darker">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">总览仪表盘</h1>
          <p className="text-gray-400 mt-2">系统运行状态和统计数据</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            icon={<Zap className="text-blue-400" size={24} />}
            label="本体技能"
            value={ontologySkills.length}
            color="blue"
          />
          <StatCard
            icon={<Target className="text-purple-400" size={24} />}
            label="外部技能"
            value={externalSkills.length}
            color="purple"
          />
          <StatCard
            icon={<Activity className="text-green-400" size={24} />}
            label="今日执行"
            value={todayLogs.length}
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="text-yellow-400" size={24} />}
            label="成功率"
            value={`${successRate}%`}
            color="yellow"
          />
        </div>

        {/* 数据库状态和执行日志 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 数据库状态 */}
          <div className="glass-effect rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database size={20} />
              数据库状态
            </h2>
            <div className="space-y-3">
              {databaseStatus && (
                <>
                  <DatabaseStatusItem
                    name="MongoDB"
                    status={databaseStatus.mongodb.status}
                  />
                  <DatabaseStatusItem
                    name="Neo4j"
                    status={databaseStatus.neo4j.status}
                  />
                  <DatabaseStatusItem
                    name="ChromaDB"
                    status={databaseStatus.chromadb.status}
                  />
                </>
              )}
            </div>
          </div>

          {/* 最近执行日志 */}
          <div className="glass-effect rounded-lg p-6 xl:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity size={20} />
              最近执行
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">暂无执行记录</p>
            ) : (
              <div className="space-y-3">
                {logs.slice(0, 5).map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {log.status === 'success' ? (
                        <CheckCircle className="text-green-400 flex-shrink-0" size={18} />
                      ) : (
                        <XCircle className="text-red-400 flex-shrink-0" size={18} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{log.skill_name}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(log.created_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 ml-3 flex-shrink-0 font-mono">
                      {log.duration_ms}ms
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorClass = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
  }[color] || 'text-gray-400';

  return (
    <div className="glass-effect rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function DatabaseStatusItem({ name, status }: {
  name: string;
  status: 'online' | 'offline';
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <span className="text-sm font-medium">{name}</span>
      <div className="flex items-center gap-2">
        {status === 'online' ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs text-green-400 font-medium">在线</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
            <span className="text-xs text-gray-500 font-medium">离线</span>
          </>
        )}
      </div>
    </div>
  );
}
