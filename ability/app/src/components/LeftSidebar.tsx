import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, Database, ShoppingCart, FileText, FlaskConical, ArrowLeft, Share2, Zap } from 'lucide-react';
import { useAbilityStore } from '../store/ability-store';

const PALETTE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#F97316', '#EF4444', '#06B6D4', '#8B5CF6',
];

export default function LeftSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { ontologyId } = useParams<{ ontologyId: string }>();
  const { currentOntology } = useAbilityStore();

  const navItems = [
    { path: 'dashboard', icon: LayoutDashboard, label: '总览仪表盘' },
    { path: 'ontology-skills', icon: Database, label: '本体技能' },
    { path: 'skills', icon: ShoppingCart, label: '技能市场' },
    { path: 'test', icon: FlaskConical, label: '本体技能测试' },
    { path: 'test-external', icon: Zap, label: '外部技能测试' },
    { path: 'logs', icon: FileText, label: '执行历史' },
  ];

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-[#0E0E14] border-r border-white/8 h-screen overflow-y-auto relative">
      {/* Logo header */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/8 flex-shrink-0">
        <Share2 size={18} className="text-indigo-400" />
        <span className="text-white font-semibold text-sm">能力层管理</span>
      </div>

      {/* Current ontology card */}
      {currentOntology && (
        <div className="px-4 py-3 flex-shrink-0">
          <p className="text-xs text-white/40 uppercase tracking-wider">当前本体</p>
          <div className="bg-white/5 rounded-xl p-3 mt-2 flex items-center gap-2">
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentOntology.display_name}</p>
              <p className="text-xs text-white/40">{currentOntology.ontology_code}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-4 flex-1">
        <div className="flex items-center justify-between px-4 py-1">
          <span className="text-xs uppercase text-white/30 tracking-wider">功能导航</span>
        </div>
        <ul className="mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const fullPath = `/${ontologyId}/${item.path}`;
            const isActive = location.pathname === fullPath;
            return (
              <li key={item.path} className="px-3 py-1 my-0.5 mx-2">
                <div
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isActive ? 'bg-indigo-600/20 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                  onClick={() => navigate(fullPath)}
                >
                  {isActive && <span className="w-0.5 h-5 bg-indigo-500 rounded-full absolute left-0" />}
                  <Icon size={16} />
                  <span className="text-sm">{item.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Back link */}
      <div className="px-4 py-3 flex-shrink-0 border-t border-white/8">
        <div
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          onClick={() => navigate('/applications')}
        >
          <ArrowLeft size={14} />
          <span>返回应用列表</span>
        </div>
      </div>

      {/* Palette */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {PALETTE_COLORS.map((color) => (
            <button
              key={color}
              className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
