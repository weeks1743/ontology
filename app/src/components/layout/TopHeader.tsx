import { useNavigate } from 'react-router-dom';
import { Search, Save, List, LayoutGrid, Plus, Bell } from 'lucide-react';

interface Props {
  ontologyName: string;
  activeTab: string;
  ontologyId: number;
}

const TAB_LABELS: Record<string, string> = {
  topology: '可视化图谱',
  objects: '对象实体',
  behaviors: '逻辑行为',
  rules: '约束规则',
  events: '消息事件',
  scenarios: '业务场景',
  yaml: 'YAML 查看',
};

export default function TopHeader({ ontologyName: _ontologyName, activeTab, ontologyId: _ontologyId }: Props) {
  const navigate = useNavigate();
  const activeTabLabel = TAB_LABELS[activeTab] ?? activeTab;

  const isTopology = activeTab === 'topology';
  const isYaml = activeTab === 'yaml';
  const showViewToggles = !isTopology && !isYaml;
  const showAddButton = !isTopology && !isYaml;

  return (
    <header className="h-14 bg-[#0A0A0B] border-b border-white/10 px-5 flex items-center">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          本体模型列表
        </button>
        <span className="text-white/20 text-sm">/</span>
        <span className="text-sm text-white/70">{activeTabLabel}</span>
      </div>

      {/* Middle: Search */}
      <div className="flex-1 flex justify-center">
        <div className="w-72 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/50 flex items-center gap-2 cursor-default select-none">
          <Search size={14} className="shrink-0 text-white/30" />
          <span>全站搜索 {activeTabLabel}...</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Save layout — topology only */}
        {isTopology && (
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 transition-colors">
            <Save size={14} />
            保存布局
          </button>
        )}

        {/* View toggles — not topology / yaml */}
        {showViewToggles && (
          <>
            <button className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <List size={16} />
            </button>
            <button className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <LayoutGrid size={16} />
            </button>
          </>
        )}

        {/* Divider */}
        {showAddButton && <div className="w-px h-5 bg-white/10" />}

        {/* Add button — not topology / yaml */}
        {showAddButton && (
          <button className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors">
            <Plus size={14} />
            新增
          </button>
        )}

        {/* Bell */}
        <button className="p-2 text-white/40 hover:text-white rounded-lg transition-colors">
          <Bell size={16} />
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white select-none">
          U
        </div>
      </div>
    </header>
  );
}
