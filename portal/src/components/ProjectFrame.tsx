import type { LayerConfig } from '../config/layers';
import { usePortalStore } from '../store/portal-store';

export default function ProjectFrame({ layer }: { layer: LayerConfig }) {
  const activeLayer = usePortalStore((s) => s.activeLayer);
  const isActive = activeLayer === layer.id;

  if (layer.type !== 'iframe' || !layer.url) return null;

  return (
    <iframe
      title={layer.label}
      src={layer.url}
      className="w-full border-0"
      style={{
        height: 'calc(100vh - 48px)',
        display: isActive ? 'block' : 'none',
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
    />
  );
}
