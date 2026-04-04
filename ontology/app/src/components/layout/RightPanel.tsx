import { X, ArrowRight, Tag } from 'lucide-react';
import { useOntologyStore } from '../../store/ontology-store';
import type {
  ObjectDraft,
  BehaviorDraft,
  RuleDraft,
  EventDraft,
  ScenarioDraft,
  SelectedEntity,
} from '../../types/ontology';

interface Props {
  ontologyId: number;
}

// ── Helper components ─────────────────────────────────────────��──────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-white/40">{label}</span>
      <div className="text-sm text-white">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/8 text-white/70 text-xs px-2 py-0.5 rounded">
      {children}
    </span>
  );
}

const LIFECYCLE_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-green-500/20 text-green-300',
  'bg-yellow-500/20 text-yellow-300',
  'bg-orange-500/20 text-orange-300',
  'bg-purple-500/20 text-purple-300',
];

function LifecycleBadge({ stage, index }: { stage: string; index: number }) {
  const colorClass = LIFECYCLE_COLORS[index % LIFECYCLE_COLORS.length];
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colorClass}`}>
      {stage}
    </span>
  );
}

function Divider() {
  return <div className="border-t border-white/8 my-3" />;
}

// ── Trigger type display labels ──────────────────────────────────────────────

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  USER_ACTION: '用户操作',
  AI_OR_USER_ACTION: 'AI / 用户操作',
  SYSTEM_ACTION: '系统操作',
  SYSTEM_OR_MANAGER_ACTION: '系统 / 管理员操作',
};

// ── Severity badge ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-500/20 text-green-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  high: 'bg-orange-500/20 text-orange-300',
  critical: 'bg-red-500/20 text-red-300',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? 'bg-white/8 text-white/70';
  const label = SEVERITY_LABELS[severity] ?? severity;
  return <span className={`text-xs px-2 py-0.5 rounded ${style}`}>{label}</span>;
}

// ── Detail panels ────────────────────────────────────────────────────────────

function ObjectDetail({ obj }: { obj: ObjectDraft }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow label="代码">
        <span className="text-indigo-400 font-mono">{obj.code}</span>
      </InfoRow>
      <InfoRow label="名称">{obj.name}</InfoRow>
      {obj.description && <InfoRow label="描述">{obj.description}</InfoRow>}

      <Divider />

      <InfoRow label={`生命周期 (${obj.lifecycle.length})`}>
        <div className="flex flex-wrap gap-1 mt-1">
          {obj.lifecycle.map((stage, i) => (
            <LifecycleBadge key={stage} stage={stage} index={i} />
          ))}
        </div>
      </InfoRow>

      <Divider />

      <InfoRow label={`属性 (${obj.attributes.length})`}>
        <div className="flex flex-col gap-2 mt-1">
          {obj.attributes.map((attr) => (
            <div key={attr.name} className="flex items-start gap-2">
              <Tag size={12} className="mt-0.5 shrink-0 text-white/30" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white truncate">
                    {attr.displayName || attr.name}
                  </span>
                  <Badge>{attr.type}</Badge>
                </div>
                {attr.displayName && attr.name !== attr.displayName && (
                  <span className="text-xs text-white/30 font-mono truncate">{attr.name}</span>
                )}
                {attr.description && (
                  <span className="text-xs text-white/40 truncate">{attr.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </InfoRow>

      <Divider />

      <InfoRow label={`关系 (${obj.relations_detail.length})`}>
        <div className="flex flex-col gap-2 mt-1">
          {obj.relations_detail.map((rel) => (
            <div key={rel.name} className="flex items-start gap-2">
              <ArrowRight size={12} className="mt-0.5 shrink-0 text-white/30" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white truncate">
                    {rel.displayName || rel.name}
                  </span>
                  <Badge>{rel.type}</Badge>
                </div>
                {rel.displayName && rel.name !== rel.displayName && (
                  <span className="text-xs text-white/30 font-mono truncate">{rel.name}</span>
                )}
                {rel.description && (
                  <span className="text-xs text-white/40 truncate">{rel.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </InfoRow>
    </div>
  );
}

function BehaviorDetail({ behavior }: { behavior: BehaviorDraft }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow label="代码">
        <span className="text-indigo-400 font-mono">{behavior.code}</span>
      </InfoRow>
      <InfoRow label="名称">{behavior.name}</InfoRow>
      <InfoRow label="归属对象">{behavior.owner_object}</InfoRow>
      <InfoRow label="触发类型">
        {TRIGGER_TYPE_LABELS[behavior.trigger_type] ?? behavior.trigger_type}
      </InfoRow>

      <Divider />

      <InfoRow label="引用规则">
        <div className="flex flex-wrap gap-1 mt-1">
          {behavior.referenced_rules.length > 0
            ? behavior.referenced_rules.map((code) => <Badge key={code}>{code}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>

      <InfoRow label="触发事件">
        <div className="flex flex-wrap gap-1 mt-1">
          {behavior.emits_events.length > 0
            ? behavior.emits_events.map((code) => <Badge key={code}>{code}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>

      <InfoRow label="回写目标">
        <div className="flex flex-wrap gap-1 mt-1">
          {behavior.writeback_targets.length > 0
            ? behavior.writeback_targets.map((t) => <Badge key={t}>{t}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>
    </div>
  );
}

function RuleDetail({ rule }: { rule: RuleDraft }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow label="代码">
        <span className="text-indigo-400 font-mono">{rule.code}</span>
      </InfoRow>
      <InfoRow label="名称">{rule.name}</InfoRow>
      <InfoRow label="类型">{rule.type}</InfoRow>
      <InfoRow label="严重度">
        <SeverityBadge severity={rule.severity} />
      </InfoRow>

      <Divider />

      <InfoRow label="适用对象">
        <div className="flex flex-wrap gap-1 mt-1">
          {rule.applicable_objects.length > 0
            ? rule.applicable_objects.map((code) => <Badge key={code}>{code}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>

      <Divider />

      <InfoRow label="表达式">
        <pre className="mt-1 text-xs font-mono bg-white/5 rounded p-2 whitespace-pre-wrap break-all text-white/70">
          {rule.expression}
        </pre>
      </InfoRow>

      {rule.failure_message && (
        <InfoRow label="失败消息">{rule.failure_message}</InfoRow>
      )}
    </div>
  );
}

function EventDetail({ event }: { event: EventDraft }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow label="代码">
        <span className="text-indigo-400 font-mono">{event.code}</span>
      </InfoRow>
      <InfoRow label="名称">{event.name}</InfoRow>
      <InfoRow label="产生对象">{event.producer_object}</InfoRow>
      <InfoRow label="产生行为">{event.producer_behavior}</InfoRow>

      <Divider />

      <InfoRow label="订阅行为">
        <div className="flex flex-wrap gap-1 mt-1">
          {event.subscribers.length > 0
            ? event.subscribers.map((code) => <Badge key={code}>{code}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>

      <InfoRow label="影响对象">
        <div className="flex flex-wrap gap-1 mt-1">
          {event.impacted_objects.length > 0
            ? event.impacted_objects.map((code) => <Badge key={code}>{code}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>
    </div>
  );
}

function ScenarioDetail({ scenario }: { scenario: ScenarioDraft }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow label="代码">
        <span className="text-indigo-400 font-mono">{scenario.code}</span>
      </InfoRow>
      <InfoRow label="名称">{scenario.name}</InfoRow>
      {scenario.business_goal && (
        <InfoRow label="业务目标">{scenario.business_goal}</InfoRow>
      )}

      <Divider />

      <InfoRow label="涉及对象">
        <div className="flex flex-wrap gap-1 mt-1">
          {scenario.involved_objects.length > 0
            ? scenario.involved_objects.map((code) => <Badge key={code}>{code}</Badge>)
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>

      <Divider />

      <InfoRow label={`步骤 (${scenario.steps.length})`}>
        <div className="flex flex-col gap-2 mt-1">
          {scenario.steps.map((step) => (
            <div key={step.step} className="flex items-start gap-2">
              <span className="shrink-0 text-xs text-white/40 w-4 text-right">{step.step}.</span>
              <span className="text-sm text-white/80">
                {step.behavior ?? step.event ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </InfoRow>

      <Divider />

      <InfoRow label="成功条件">
        <div className="flex flex-col gap-1 mt-1">
          {scenario.success_criteria.length > 0
            ? scenario.success_criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="shrink-0 text-white/30 text-xs mt-0.5">•</span>
                  <span className="text-sm text-white/80">{c}</span>
                </div>
              ))
            : <span className="text-white/30 text-xs">—</span>}
        </div>
      </InfoRow>
    </div>
  );
}

// ── Panel title ──────────────────────────────────────────────────────────────

function panelTitle(type: SelectedEntity['type']): string {
  switch (type) {
    case 'object': return '对象详情';
    case 'behavior': return '行为详情';
    case 'rule': return '规则详情';
    case 'event': return '事件详情';
    case 'scenario': return '场景详情';
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function RightPanel({ ontologyId: _ontologyId }: Props) {  const {
    selectedEntity,
    closeRightPanel,
    objects,
    behaviors,
    rules,
    events,
    scenarios,
  } = useOntologyStore();

  const renderContent = () => {
    if (!selectedEntity) {
      return (
        <div className="flex flex-1 items-center justify-center text-white/30 text-sm">
          未选择实体
        </div>
      );
    }

    switch (selectedEntity.type) {
      case 'object': {
        const obj = objects.find((o) => o.code === selectedEntity.code);
        if (!obj) return <div className="flex flex-1 items-center justify-center text-white/30 text-sm">未找到实体</div>;
        return <ObjectDetail obj={obj} />;
      }
      case 'behavior': {
        const behavior = behaviors.find((b) => b.code === selectedEntity.code);
        if (!behavior) return <div className="flex flex-1 items-center justify-center text-white/30 text-sm">未找到实体</div>;
        return <BehaviorDetail behavior={behavior} />;
      }
      case 'rule': {
        const rule = rules.find((r) => r.code === selectedEntity.code);
        if (!rule) return <div className="flex flex-1 items-center justify-center text-white/30 text-sm">未找到实体</div>;
        return <RuleDetail rule={rule} />;
      }
      case 'event': {
        const event = events.find((e) => e.code === selectedEntity.code);
        if (!event) return <div className="flex flex-1 items-center justify-center text-white/30 text-sm">未找到实体</div>;
        return <EventDetail event={event} />;
      }
      case 'scenario': {
        const scenario = scenarios.find((s) => s.code === selectedEntity.code);
        if (!scenario) return <div className="flex flex-1 items-center justify-center text-white/30 text-sm">未找到实体</div>;
        return <ScenarioDetail scenario={scenario} />;
      }
      default:
        return null;
    }
  };

  return (
    <div className="w-72 flex-shrink-0 bg-[#0E0E14] border-l border-white/8 flex flex-col h-screen overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-white">
          {selectedEntity ? panelTitle(selectedEntity.type) : '详情'}
        </span>
        <button
          onClick={closeRightPanel}
          className="text-white/40 hover:text-white transition-colors"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 px-5 py-4">
        {renderContent()}
      </div>
    </div>
  );
}
