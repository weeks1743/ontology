import { useSceneStore } from '../../store/scene-store';

// CRM lifecycle stages — product-level descriptions
const CRM_LIFECYCLE = [
  {
    code: 'LEAD_DISCOVERY',
    name: '线索发现',
    icon: '🔍',
    description: '通过多维数据源挖掘潜在客户，识别高价值商机',
    capabilities: ['客户画像构建', '行业线索推荐', '竞品动态追踪', '商机评分模型'],
    color: '#6366F1',
  },
  {
    code: 'NEEDS_ANALYSIS',
    name: '需求分析',
    icon: '📋',
    description: '深入了解客户业务痛点，精准匹配产品价值',
    capabilities: ['拜访记录分析', '需求自动归纳', '痛点优先级排序', '客户决策链梳理'],
    color: '#3B82F6',
  },
  {
    code: 'SOLUTION_PRESENT',
    name: '方案呈现',
    icon: '💡',
    description: '一键生成行业定制化方案，提升客户认知效率',
    capabilities: ['售前方案生成', '行业案例匹配', 'ROI量化分析', '竞品对比报告'],
    color: '#10B981',
  },
  {
    code: 'NEGOTIATION',
    name: '商务谈判',
    icon: '🤝',
    description: '智能辅助报价与条款建议，加速成交周期',
    capabilities: ['智能报价方案', '合同风险审查', '条款优化建议', '竞标策略推荐'],
    color: '#F59E0B',
  },
  {
    code: 'AFTER_SALES',
    name: '售后维护',
    icon: '🔧',
    description: '持续跟踪客户健康度，驱动续约与增购',
    capabilities: ['续约风险评估', '客户健康度监控', '增购机会识别', '服务满意度分析'],
    color: '#EF4444',
  },
];

export function CapabilityView() {
  const { selectedIndustry } = useSceneStore();

  if (!selectedIndustry) {
    return (
      <div className="text-center py-20">
        <p className="text-white/30">请先选择行业</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-1">行业能力库</h2>
        <p className="text-sm text-white/40">
          {selectedIndustry.icon} {selectedIndustry.name} · CRM 全链路销售能力
        </p>
      </div>

      {/* Lifecycle flow */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {CRM_LIFECYCLE.map((stage, i) => (
          <div key={stage.code} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5">
              <span className="text-sm">{stage.icon}</span>
              <span className="text-xs text-white/60 whitespace-nowrap">{stage.name}</span>
            </div>
            {i < CRM_LIFECYCLE.length - 1 && (
              <svg className="w-3 h-3 text-white/15 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Stage cards */}
      <div className="space-y-5">
        {CRM_LIFECYCLE.map((stage) => (
          <div
            key={stage.code}
            className="rounded-2xl border border-white/8 p-6"
            style={{ background: `linear-gradient(135deg, ${stage.color}08 0%, transparent 100%)` }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                style={{ backgroundColor: `${stage.color}15` }}
              >
                {stage.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white/90 mb-1">{stage.name}</h3>
                <p className="text-sm text-white/40 mb-4">{stage.description}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stage.capabilities.map((cap) => (
                    <div
                      key={cap}
                      className="rounded-lg px-3 py-2 text-xs text-white/55"
                      style={{ backgroundColor: `${stage.color}08` }}
                    >
                      {cap}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
