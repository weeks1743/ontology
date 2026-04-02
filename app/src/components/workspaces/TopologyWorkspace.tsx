import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useOntologyStore } from '../../store/ontology-store';
import type { EntityType } from '../../types/ontology';
import { Play, RotateCcw } from 'lucide-react';

interface Props {
  ontologyId: number;
}

const CATEGORIES = [
  { name: '数据实体', color: '#6366F1' },
  { name: '行为操作', color: '#10B981' },
  { name: '业务规则', color: '#F59E0B' },
  { name: '消息事件', color: '#F97316' },
  { name: '业务场景', color: '#8B5CF6' },
];

export default function TopologyWorkspace({ ontologyId: _ontologyId }: Props) {
  const { objects, behaviors, rules, events, scenarios, selectEntity } = useOntologyStore();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1); // -1 表示初始状态，未开始模拟

  const activeScenario = useMemo(
    () => (selectedScenario ? scenarios.find((s) => s.code === selectedScenario) ?? null : null),
    [selectedScenario, scenarios],
  );

  // 获取当前步骤的详细信息
  const currentStepInfo = useMemo(() => {
    if (!activeScenario || !isSimulating || currentStep < 0) return null;

    const step = activeScenario.steps[currentStep];
    if (!step) return null;

    let title = '';
    let description = '';

    if (step.behavior) {
      const behavior = behaviors.find(b => b.code === step.behavior);
      const obj = behavior ? objects.find(o => o.code === behavior.owner_object) : null;
      title = `调用 ${obj?.name || ''}.${behavior?.name || step.behavior}`;
      description = `流程步骤${step.step}：触发${obj?.name || '对象'}的【${behavior?.name || step.behavior}】行为。`;
    } else if (step.event) {
      const event = events.find(e => e.code === step.event);
      const obj = event ? objects.find(o => o.code === event.producer_object) : null;
      title = `${event?.name || step.event} 事件`;
      description = `${obj?.name || '对象'}触发【${event?.name || step.event}】事件，等待后续处理。`;
    }

    return { step: step.step, title, description };
  }, [activeScenario, isSimulating, currentStep, behaviors, objects, events]);

  // Compute the set of node IDs involved in the active scenario
  const scenarioNodeIds = useMemo<Set<string>>(() => {
    if (!activeScenario) return new Set();
    const ids = new Set<string>();

    // 如果处于模拟模式，只显示到当前步骤的节点
    if (isSimulating && currentStep >= 0) {
      // 添加场景节点本身
      ids.add(`scenario_${activeScenario.code}`);

      // 只添加到当前步骤的节点
      for (let i = 0; i <= currentStep; i++) {
        const step = activeScenario.steps[i];
        if (step.behavior) {
          ids.add(`beh_${step.behavior}`);
          // 添加行为的归属对象
          const behavior = behaviors.find(b => b.code === step.behavior);
          if (behavior?.owner_object) {
            ids.add(`obj_${behavior.owner_object}`);
          }
          // 添加行为引用的规则
          behavior?.referenced_rules.forEach(ruleCode => {
            ids.add(`rule_${ruleCode}`);
          });
        }
        if (step.event) {
          ids.add(`evt_${step.event}`);
          // 添加事件的产生对象和影响对象
          const event = events.find(e => e.code === step.event);
          if (event?.producer_object) {
            ids.add(`obj_${event.producer_object}`);
          }
          event?.impacted_objects.forEach(objCode => {
            ids.add(`obj_${objCode}`);
          });
        }
      }
    } else {
      // 非模拟模式，显示所有相关节点
      activeScenario.involved_objects.forEach((code) => ids.add(`obj_${code}`));
      activeScenario.steps.forEach((step) => {
        if (step.behavior) ids.add(`beh_${step.behavior}`);
        if (step.event) ids.add(`evt_${step.event}`);
      });
    }

    return ids;
  }, [activeScenario, isSimulating, currentStep, behaviors, events]);

  const option = useMemo(() => {
    // Build nodes
    const nodes: object[] = [];

    // 如果处于模拟模式，添加场景节点
    if (isSimulating && activeScenario && currentStep >= 0) {
      nodes.push({
        id: `scenario_${activeScenario.code}`,
        name: activeScenario.name,
        value: activeScenario.code,
        category: 4,
        symbolSize: 50,
        itemStyle: { color: '#8B5CF6' },
        label: { show: true, position: 'bottom', color: '#fff', fontSize: 12 },
      });
    }

    // 添加对象节点
    nodes.push(
      ...objects.map((o) => {
        const isInScenario = scenarioNodeIds.has(`obj_${o.code}`);
        const shouldShow = !isSimulating || isInScenario;
        return {
          id: `obj_${o.code}`,
          name: o.name,
          value: o.code,
          category: 0,
          symbolSize: isSimulating && isInScenario ? 44 : activeScenario && isInScenario ? 44 : 36,
          itemStyle: !shouldShow ? { opacity: 0 } : !isInScenario && activeScenario ? { opacity: 0.25 } : undefined,
          label: { show: shouldShow, position: 'bottom', color: '#fff', fontSize: 11 },
        };
      })
    );

    // 添加行为节点
    nodes.push(
      ...behaviors.map((b) => {
        const isInScenario = scenarioNodeIds.has(`beh_${b.code}`);
        const shouldShow = !isSimulating || isInScenario;
        return {
          id: `beh_${b.code}`,
          name: b.name,
          value: b.code,
          category: 1,
          symbolSize: isSimulating && isInScenario ? 34 : activeScenario && isInScenario ? 34 : 28,
          itemStyle: !shouldShow ? { opacity: 0 } : !isInScenario && activeScenario ? { opacity: 0.25 } : undefined,
          label: { show: shouldShow, position: 'bottom', color: '#fff', fontSize: 10 },
        };
      })
    );

    // 添加规则节点
    nodes.push(
      ...rules.map((r) => {
        const isInScenario = scenarioNodeIds.has(`rule_${r.code}`);
        const shouldShow = !isSimulating || isInScenario;
        return {
          id: `rule_${r.code}`,
          name: r.name,
          value: r.code,
          category: 2,
          symbolSize: 22,
          itemStyle: !shouldShow ? { opacity: 0 } : activeScenario ? { opacity: 0.2 } : undefined,
          label: { show: shouldShow, position: 'bottom', color: '#fff', fontSize: 9 },
        };
      })
    );

    // 添加事件节点
    nodes.push(
      ...events.map((e) => {
        const isInScenario = scenarioNodeIds.has(`evt_${e.code}`);
        const shouldShow = !isSimulating || isInScenario;
        return {
          id: `evt_${e.code}`,
          name: e.name,
          value: e.code,
          category: 3,
          symbolSize: isSimulating && isInScenario ? 28 : activeScenario && isInScenario ? 28 : 22,
          itemStyle: !shouldShow ? { opacity: 0 } : !isInScenario && activeScenario ? { opacity: 0.25 } : undefined,
          label: { show: shouldShow, position: 'bottom', color: '#fff', fontSize: 9 },
        };
      })
    );

    // Build edges
    const edges: object[] = [];

    // Object relations (solid cyan for direct object-to-object relationships)
    objects.forEach((obj) => {
      obj.relations_detail.forEach((rel) => {
        if (rel.target_object) {
          const relationLabel = rel.displayName || rel.name;
          edges.push({
            source: `obj_${obj.code}`,
            target: `obj_${rel.target_object}`,
            lineStyle: { color: 'rgba(34,211,238,0.5)', width: 1.5, type: 'solid' },
            label: {
              show: true,
              formatter: relationLabel,
              fontSize: 9,
              color: 'rgba(34,211,238,0.8)',
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: [2, 4],
              borderRadius: 3,
            },
            tooltip: {
              formatter: () => {
                const desc = rel.description ? `<br/>${rel.description}` : '';
                return `<strong>${obj.name}</strong> → <strong>${relationLabel}</strong> → <strong>${objects.find(o => o.code === rel.target_object)?.name || rel.target_object}</strong>${desc}`;
              },
            },
          });
        }
      });
    });

    behaviors.forEach((b) => {
      // owner_object → behavior (solid indigo)
      if (b.owner_object) {
        const ownerObj = objects.find(o => o.code === b.owner_object);
        edges.push({
          source: `obj_${b.owner_object}`,
          target: `beh_${b.code}`,
          lineStyle: { color: 'rgba(99,102,241,0.6)', width: 2, type: 'solid' },
          label: {
            show: true,
            formatter: '拥有行为',
            fontSize: 9,
            color: 'rgba(99,102,241,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: [2, 4],
            borderRadius: 3,
          },
          tooltip: {
            formatter: () => `<strong>${ownerObj?.name || b.owner_object}</strong> 拥有行为 <strong>${b.name}</strong>`,
          },
        });
      }

      // behavior → emits_events (solid orange)
      b.emits_events.forEach((evtCode) => {
        const evt = events.find(e => e.code === evtCode);
        edges.push({
          source: `beh_${b.code}`,
          target: `evt_${evtCode}`,
          lineStyle: { color: 'rgba(249,115,22,0.6)', width: 1.5, type: 'solid' },
          label: {
            show: true,
            formatter: '触发事件',
            fontSize: 9,
            color: 'rgba(249,115,22,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: [2, 4],
            borderRadius: 3,
          },
          tooltip: {
            formatter: () => `<strong>${b.name}</strong> 触发事件 <strong>${evt?.name || evtCode}</strong>`,
          },
        });
      });

      // behavior → referenced_rules (dashed amber)
      b.referenced_rules.forEach((ruleCode) => {
        const rule = rules.find(r => r.code === ruleCode);
        edges.push({
          source: `beh_${b.code}`,
          target: `rule_${ruleCode}`,
          lineStyle: { color: 'rgba(245,158,11,0.5)', width: 1, type: 'dashed' },
          label: {
            show: true,
            formatter: '引用规则',
            fontSize: 9,
            color: 'rgba(245,158,11,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: [2, 4],
            borderRadius: 3,
          },
          tooltip: {
            formatter: () => `<strong>${b.name}</strong> 引用规则 <strong>${rule?.name || ruleCode}</strong>`,
          },
        });
      });
    });

    // rule → applicable_objects (dotted amber)
    rules.forEach((r) => {
      r.applicable_objects.forEach((objCode) => {
        const obj = objects.find(o => o.code === objCode);
        edges.push({
          source: `rule_${r.code}`,
          target: `obj_${objCode}`,
          lineStyle: { color: 'rgba(245,158,11,0.4)', width: 1, type: 'dotted' },
          label: {
            show: true,
            formatter: '适用于',
            fontSize: 9,
            color: 'rgba(245,158,11,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: [2, 4],
            borderRadius: 3,
          },
          tooltip: {
            formatter: () => `<strong>${r.name}</strong> 适用于 <strong>${obj?.name || objCode}</strong>`,
          },
        });
      });
    });

    // event → impacted_objects (dotted orange)
    events.forEach((e) => {
      e.impacted_objects.forEach((objCode) => {
        const obj = objects.find(o => o.code === objCode);
        edges.push({
          source: `evt_${e.code}`,
          target: `obj_${objCode}`,
          lineStyle: { color: 'rgba(249,115,22,0.4)', width: 1, type: 'dotted' },
          label: {
            show: true,
            formatter: '影响对象',
            fontSize: 9,
            color: 'rgba(249,115,22,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: [2, 4],
            borderRadius: 3,
          },
          tooltip: {
            formatter: () => `<strong>${e.name}</strong> 影响对象 <strong>${obj?.name || objCode}</strong>`,
          },
        });
      });
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            return params.data.tooltip?.formatter?.() || params.name || '';
          }
          return params.name || params.data?.name || '';
        },
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 12 },
        padding: [8, 12],
      },
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
                        setCurrentStep(-1);
                        setIsSimulating(false);
                      } else {
                        setSelectedScenario(s.code);
                        setCurrentStep(-1);
                        setIsSimulating(false);
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
      {activeScenario && !isSimulating && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur border border-white/10 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-xs font-semibold text-violet-400 tracking-widest uppercase shrink-0">
            {activeScenario.name} - 动态模拟
          </span>
          <span className="text-sm text-white/60 flex-1">点击【下一步】开始模拟</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-white/50 font-mono">
              0 / {activeScenario.steps.length}
            </span>
            <button
              onClick={() => {
                setIsSimulating(true);
                setCurrentStep(0);
              }}
              className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 transition-colors text-white text-sm font-medium flex items-center gap-1.5"
            >
              <Play size={14} />
              下一步
            </button>
            <button
              onClick={() => {
                setSelectedScenario(null);
                setCurrentStep(-1);
                setIsSimulating(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 transition-colors text-white text-sm"
            >
              重置
            </button>
          </div>
        </div>
      )}

      {/* Bottom simulation control bar */}
      {activeScenario && isSimulating && currentStepInfo && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur border border-white/10 rounded-xl px-4 py-3">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-violet-400 tracking-widest uppercase">
                {activeScenario.name} - 动态模拟
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-mono bg-violet-500/30 text-violet-300 border border-violet-500/50"
              >
                {currentStep + 1} / {activeScenario.steps.length}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium mb-1">
                {currentStepInfo.step === 1 ? '① 流程启动' : `${['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'][Math.min(currentStepInfo.step - 1, 9)] || `⑩+${currentStepInfo.step - 10}`} ${currentStepInfo.title}`}
              </div>
              <div className="text-xs text-white/60">
                {currentStepInfo.description}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white text-sm"
              >
                上一步
              </button>
              <button
                disabled={currentStep >= activeScenario.steps.length - 1}
                onClick={() => {
                  if (currentStep < activeScenario.steps.length - 1) {
                    setCurrentStep((s) => s + 1);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white text-sm font-medium"
              >
                下一步
              </button>
              <button
                onClick={() => {
                  setIsSimulating(false);
                  setCurrentStep(-1);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 transition-colors text-white text-sm flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
