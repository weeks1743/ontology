import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, ShoppingCart, FileText, FlaskConical } from 'lucide-react';

export default function LeftSidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: '总览仪表盘' },
    { path: '/ontology-skills', icon: Database, label: '本体技能' },
    { path: '/skills', icon: ShoppingCart, label: '技能市场' },
    { path: '/test', icon: FlaskConical, label: '技能测试' },
    { path: '/logs', icon: FileText, label: '执行历史' },
  ];

  return (
    <aside className="w-56 flex-shrink-0 glass-effect border-r border-glass-border p-4">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-blue-400">能力层</h1>
        <p className="text-xs text-gray-400">Capability Layer</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
