import type { LayerConfig } from '../config/layers';

export default function ComingSoon({ layer }: { layer: LayerConfig }) {
  const Icon = layer.icon;

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ height: 'calc(100vh - 48px)' }}
    >
      <div className="text-center">
        <div
          className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${layer.color}20` }}
        >
          <Icon size={32} style={{ color: layer.color }} />
        </div>
        <h2 className="text-xl font-semibold text-white/90 mb-2">{layer.label}</h2>
        <p className="text-sm text-white/40">Coming Soon</p>
      </div>
    </div>
  );
}
