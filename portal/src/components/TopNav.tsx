import { LAYERS } from '../config/layers';
import { usePortalStore } from '../store/portal-store';

export default function TopNav() {
  const { activeLayer, setActiveLayer } = usePortalStore();

  return (
    <nav className="flex items-center h-12 px-4 bg-[#0f172a] border-b border-white/10 shrink-0 z-50">
      <div className="flex items-center gap-1">
        {LAYERS.map((layer) => {
          const Icon = layer.icon;
          const isActive = activeLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer"
              style={{
                color: isActive ? layer.color : '#94a3b8',
                backgroundColor: isActive ? `${layer.color}15` : 'transparent',
                borderBottom: isActive ? `2px solid ${layer.color}` : '2px solid transparent',
              }}
            >
              <Icon size={16} />
              <span>{layer.label}</span>
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center">
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50">
          U
        </div>
      </div>
    </nav>
  );
}
