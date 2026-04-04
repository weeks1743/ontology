import { Share2, ChevronDown, Network, Box, Zap, Shield, Bell, Film, Code } from 'lucide-react';
import { useOntologyStore } from '../../store/ontology-store';
import type { TabKey } from '../../types/ontology';

interface Props {
  ontology: { id: number; ontology_code: string; display_name: string; description: string };
  onBackToList: () => void;
}

interface NavItem {
  key: TabKey;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'topology', icon: Network, label: '可视化图谱' },
  { key: 'objects', icon: Box, label: '对象实体' },
  { key: 'behaviors', icon: Zap, label: '逻辑行为' },
  { key: 'rules', icon: Shield, label: '约束规则' },
  { key: 'events', icon: Bell, label: '消息事件' },
  { key: 'scenarios', icon: Film, label: '业务场景' },
  { key: 'yaml', icon: Code, label: 'YAML 查看' },
];

export default function LeftSidebar({ ontology, onBackToList }: Props) {
  const activeTab = useOntologyStore((s) => s.activeTab);
  const setActiveTab = useOntologyStore((s) => s.setActiveTab);

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-[#0E0E14] border-r border-white/8 h-screen overflow-y-auto relative">
      {/* Logo header */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/8 flex-shrink-0">
        <Share2 size={18} className="text-indigo-400" />
        <span className="text-white font-semibold text-sm">本体管理系统</span>
      </div>

      {/* Current ontology section */}
      <div className="px-4 py-3 flex-shrink-0">
        <p className="text-xs text-white/40 uppercase tracking-wider">当前本体模型</p>
        <div
          className="bg-white/5 rounded-xl p-3 mt-2 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={onBackToList}
        >
          <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
            <Box size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{ontology.display_name}</p>
            <p className="text-xs text-white/40">v0.1.0 · 草稿</p>
          </div>
          <ChevronDown size={14} className="text-white/20 flex-shrink-0" />
        </div>
      </div>

      {/* 模型配置 section */}
      <div className="mt-4 flex-1">
        <div className="flex items-center justify-between px-4 py-1">
          <span className="text-xs uppercase text-white/30 tracking-wider">模型配置</span>
          <ChevronDown size={12} className="text-white/30" />
        </div>

        <ul className="mt-1">
          {NAV_ITEMS.map(({ key, icon: Icon, label }) => {
            const isActive = activeTab === key;
            return (
              <li key={key} className="px-3 py-1 my-0.5 mx-2">
                <div
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-indigo-600/20 text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                  onClick={() => setActiveTab(key)}
                >
                  {isActive && (
                    <span className="w-0.5 h-5 bg-indigo-500 rounded-full absolute left-0" />
                  )}
                  <Icon size={16} />
                  <span className="text-sm">{label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

    </div>
  );
}
