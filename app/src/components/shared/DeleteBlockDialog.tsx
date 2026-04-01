import type { BlockReference } from '../../types/ontology';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  entityName: string;
  references: BlockReference[];
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  object: '对象', behavior: '行为', rule: '规则', event: '事件', scenario: '场景',
};

const REASON_LABELS: Record<string, string> = {
  owner_object: '归属对象',
  applicable_objects: '适用对象',
  applicable_behaviors: '适用行为',
  producer_object: '产生对象',
  producer_behavior: '产生行为',
  subscribers: '订阅行为',
  impacted_objects: '影响对象',
  emits_events: '触发事件',
  referenced_rules: '引用规则',
  involved_objects: '涉及对象',
  'steps[].behavior': '场景步骤（行为）',
  'steps[].event': '场景步骤（事件）',
  'relations_detail.target_object': '关系目标对象',
};

export default function DeleteBlockDialog({ entityName, references, onClose }: Props) {
  const grouped = references.reduce<Record<string, BlockReference[]>>((acc, r) => {
    const k = r.entity_type;
    (acc[k] = acc[k] ?? []).push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[#141416] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">无法删除</h3>
              <p className="text-xs text-white/40 mt-0.5">「{entityName}」被以下实体引用</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Reference list */}
        <div className="px-6 py-5 max-h-80 overflow-y-auto space-y-4">
          {Object.entries(grouped).map(([type, refs]) => (
            <div key={type}>
              <div className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">
                {TYPE_LABELS[type] ?? type} ({refs.length})
              </div>
              <div className="space-y-2">
                {refs.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/4 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-white">{r.entity_name}</span>
                      <span className="text-xs font-mono text-white/40 ml-2">{r.entity_code}</span>
                    </div>
                    <span className="text-xs text-white/30 ml-4 flex-shrink-0">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-xs text-white/40 mb-3">请先解除以上引用，再删除此实体。</p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-white/8 hover:bg-white/12 rounded-lg text-sm transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
