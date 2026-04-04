import TopNav from './components/TopNav';
import ProjectFrame from './components/ProjectFrame';
import ComingSoon from './components/ComingSoon';
import { LAYERS } from './config/layers';
import { usePortalStore } from './store/portal-store';

export default function App() {
  const activeLayer = usePortalStore((s) => s.activeLayer);
  const active = LAYERS.find((l) => l.id === activeLayer)!;

  return (
    <>
      <TopNav />
      <div className="flex-1 overflow-hidden bg-[#0a0f1e]">
        {LAYERS.map((layer) =>
          layer.type === 'iframe' ? (
            <ProjectFrame key={layer.id} layer={layer} />
          ) : activeLayer === layer.id ? (
            <ComingSoon key={layer.id} layer={layer} />
          ) : null
        )}
      </div>
    </>
  );
}
