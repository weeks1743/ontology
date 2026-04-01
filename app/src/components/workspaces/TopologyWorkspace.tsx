import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useOntologyStore } from '../../store/ontology-store';
import type { EntityType } from '../../types/ontology';

interface Props {
  ontologyId: number;
}

const CATEGORIES = [
  { name: '数据实体', color: '#6366F1' },
  { name: '行为操作', color: '#10B981' },
  { name: '业务规则', color: '#F59E0B' },
  { name: '消息事件', color: '#F97316' },
];

export default function TopologyWorkspace({ ontologyId: _ontologyId }: Props) {
  const { objects, behaviors, rules, events, scenarios, selectEntity } = useOntologyStore();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const activeScenario = useMemo(
    () => (selectedScenario ? scenarios.find((s) => s.code === selectedScenario) ?? null : null),
    [selectedScenario, scenarios],
  );

  // Compute the set of node IDs involved in the active scenario
  const scenarioNodeIds = useMemo<Set<string>>(() => {
    if (!activeScenario) return new Set();
    const ids = new Set<string>();
    activeScenario.involved_objects.forEach((code) => ids.add(`obj_${code}`));
    activeScenario.steps.forEach((step) => {
      if (step.behavior) ids.add(`beh_${step.behavior}`);
      if (step.event) ids.add(`evt_${step.event}`);
    });
    return ids;
  }, [activeScenario]);

  const option = useMemo(() => {
    // Build nodes
    const nodes: object[] = [
      ...objects.map((o) => ({
        id: `obj_${o.code}`,
        name: o.name,
        value: o.code,
        category: 0,
        symbolSize:
          activeScenario && !scenarioNodeIds.has(`obj_${o.code}`) ? 24 : activeScenario ? 44 : 36,
        itemStyle:
          activeScenario && !scenarioNodeIds.has(`obj_${o.code}`)
            ? { opacity: 0.25 }
            : undefined,
        label: { show: true, position: 'bottom', color: '#fff', fontSize: 11 },
      })),
      ...behaviors.map((b) => ({
        id: `beh_${b.code}`,
        name: b.name,
        value: b.code,
        category: 1,
        symbolSize:
          activeScenario && !scenarioNodeIds.has(`beh_${b.code}`) ? 18 : activeScenario ? 34 : 28,
        itemStyle:
          activeScenario && !scenarioNodeIds.has(`beh_${b.code}`)
            ? { opacity: 0.25 }
            : undefined,
      })),
      ...rules.map((r) => ({
        id: `rule_${r.code}`,
        name: r.name,
        value: r.code,
        category: 2,
        symbolSize: 22,
        itemStyle: activeScenario ? { opacity: 0.2 } : undefined,
      })),
      ...events.map((e) => ({
        id: `evt_${e.code}`,
        name: e.name,
        value: e.code,
        category: 3,
        symbolSize:
          activeScenario && !scenarioNodeIds.has(`evt_${e.code}`) ? 14 : activeScenario ? 28 : 22,
        itemStyle:
          activeScenario && !scenarioNodeIds.has(`evt_${e.code}`)
            ? { opacity: 0.25 }
            : undefined,
      })),
    ];

    // Build edges
    const edges: object[] = [];

    behaviors.forEach((b) => {
      // owner_object → behavior (solid indigo)
      if (b.owner_object) {
        edges.push({
          source: `obj_${b.owner_object}`,
          target: `beh_${b.code}`,
          lineStyle: { color: 'rgba(99,102,241,0.6)', width: 2, type: 'solid' },
        });
      }

      // behavior → emits_events (solid orange)
      b.emits_events.forEach((evtCode) => {
        edges.push({
          source: `beh_${b.code}`,
          target: `evt_${evtCode}`,
          lineStyle: { color: 'rgba(249,115,22,0.6)', width: 1.5, type: 'solid' },
        });
      });

      // behavior → referenced_rules (dashed amber)
      b.referenced_rules.forEach((ruleCode) => {
        edges.push({
          source: `beh_${b.code}`,
          target: `rule_${ruleCode}`,
          lineStyle: { color: 'rgba(245,158,11,0.5)', width: 1, type: 'dashed' },
        });
      });
    });

    // rule → applicable_objects (dotted amber)
    rules.forEach((r) => {
      r.applicable_objects.forEach((objCode) => {
        edges.push({
          source: `rule_${r.code}`,
          target: `obj_${objCode}`,
          lineStyle: { color: 'rgba(245,158,11,0.4)', width: 1, type: 'dotted' },
        });
      });
    });

    // event → impacted_objects (dotted orange)
    events.forEach((e) => {
      e.impacted_objects.forEach((objCode) => {
        edges.push({
          source: `evt_${e.code}`,
          target: `obj_${objCode}`,
          lineStyle: { color: 'rgba(249,115,22,0.4)', width: 1, type: 'dotted' },
        });
      });
    });

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}' },
      legend: [
        {
          data: CATEGORIES.map((c) => c.name),
          top: 12,
          right: 16,
          textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
          icon: 'circle',
          itemWidth: 10,
          itemHeight: 10,
        },
      ],
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: {
            repulsion: 300,
            gravity: 0.1,
            edgeLength: [80, 200],
            layoutAnimation: true,
          },
          categories: CATEGORIES.map((c) => ({
            name: c.name,
            itemStyle: { color: c.color },
          })),
          data: nodes,
          edges,
          label: {
            show: true,
            position: 'bottom',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 10,
          },
          lineStyle: { curveness: 0.2, opacity: 0.7 },
          emphasis: {
            scale: true,
            focus: 'adjacency',
            lineStyle: { width: 3 },
          },
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 8,
        },
      ],
    };
  }, [objects, behaviors, rules, events, activeScenario, scenarioNodeIds]);

  const handleNodeClick = (params: { dataType: string; data: { value: string; category: number } }) => {
    if (params.dataType !== 'node') return;
    const code = params.data.value as string;
    const category = params.data.category as number;
    const typeMap: EntityType[] = ['object', 'behavior', 'rule', 'event'];
    selectEntity({ type: typeMap[category], code });
  };

  if (objects.length === 0) {
    return (
      <div className="relative w-full h-full bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🕸️</div>
          <p className="text-white/50 text-sm">暂无数据，请先添加对象实体</p>
        </div>
      </div>
    );
  }

  const totalSteps = activeScenario ? activeScenario.steps.length : 0;

  return (
    <div className="relative w-full h-full bg-[#0A0A0B]">
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        onEvents={{ click: handleNodeClick }}
      />

      {/* Left overlay panel */}
      <div className="absolute left-4 top-4 w-52 bg-black/40 backdrop-blur rounded-xl p-4 pointer-events-auto">
        {/* Node type legend */}
        <p className="text-white/60 text-xs font-medium mb-2 tracking-wide">节点类型图例</p>
        <div className="space-y-1.5">
          {[
            { label: '数据实体', color: '#6366F1', count: objects.length },
            { label: '行为操作', color: '#10B981', count: behaviors.length },
            { label: '业务规则', color: '#F59E0B', count: rules.length },
            { label: '消息事件', color: '#F97316', count: events.length },
          ].map(({ label, color, count }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-white/70 text-xs flex-1">{label}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                style={{ backgroundColor: `${color}30`, color }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* Scenario filter section */}
        {scenarios.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-xs font-medium tracking-wide">场景联动筛选</p>
              {selectedScenario && (
                <button
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  onClick={() => {
                    setSelectedScenario(null);
                    setCurrentStep(0);
                  }}
                >
                  清除
                </button>
              )}
            </div>
            <div className="space-y-1">
              {scenarios.map((s) => {
                const isActive = selectedScenario === s.code;
                return (
                  <button
                    key={s.code}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-violet-500/30 border border-violet-500/50'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                    onClick={() => {
                      if (isActive) {
                        setSelectedScenario(null);
                        setCurrentStep(0);
                      } else {
                        setSelectedScenario(s.code);
                        setCurrentStep(0);
                      }
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isActive ? '#8B5CF6' : '#8B5CF640' }}
                    />
                    <span
                      className={`text-xs flex-1 truncate ${isActive ? 'text-violet-300' : 'text-white/60'}`}
                    >
                      {s.name}
                    </span>
                    <span className="text-xs text-white/30 flex-shrink-0">
                      {s.steps.length} 步骤
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom scenario player bar */}
      {activeScenario && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur border border-white/10 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-xs font-semibold text-violet-400 tracking-widest uppercase shrink-0">
            SCENARIO
          </span>
          <span className="text-sm text-white/80 flex-1 truncate">{activeScenario.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors text-white/80 text-xs"
            >
              ‹
            </button>
            <span className="text-xs text-white/50 font-mono min-w-[48px] text-center">
              {totalSteps > 0 ? `${currentStep + 1} / ${totalSteps}` : '—'}
            </span>
            <button
              disabled={currentStep >= totalSteps - 1}
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors text-white/80 text-xs"
            >
              ›
            </button>
          </div>
          {/* Step indicators */}
          {totalSteps > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {activeScenario.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`rounded-full transition-all ${
                    i === currentStep
                      ? 'w-4 h-2 bg-violet-400'
                      : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
