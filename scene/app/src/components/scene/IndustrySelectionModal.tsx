import { useSceneStore } from '../../store/scene-store';

const INDUSTRIES = [
  {
    code: 'IT',
    icon: '💻',
    name: '信息技术',
    description: '企业软件、云服务、数字化转型',
    color: '#3B82F6',
    lifecycle: '线索发现 → 需求分析 → 方案呈现 → 商务谈判 → 售后维护',
  },
  {
    code: 'BIOLOGY',
    icon: '🧬',
    name: '生物医药',
    description: '疫苗、药品、医疗器械销售',
    color: '#10B981',
    lifecycle: '线索发现 → 需求分析 → 方案呈现 → 商务谈判 → 售后维护',
  },
  {
    code: 'FOOD',
    icon: '🍜',
    name: '食品饮料',
    description: '快消品、餐饮供应链、食品加工',
    color: '#F59E0B',
    lifecycle: '线索发现 → 需求分析 → 方案呈现 → 商务谈判 → 售后维护',
  },
];

export function IndustrySelectionModal() {
  const { industries, selectIndustry } = useSceneStore();

  const handleSelect = (code: string) => {
    const industry = industries.find(i => i.code === code);
    if (industry) {
      selectIndustry(industry);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-[720px] max-w-[90vw] bg-[#16161D] rounded-2xl border border-white/10 shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-600/15 text-indigo-400 text-xs px-3 py-1 rounded-full mb-3">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            选择行业
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">选择您要配置的行业</h2>
          <p className="text-sm text-white/40">每个行业将展示 CRM 全生命周期的销售场景与技能行业化能力</p>
        </div>

        {/* Industry cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INDUSTRIES.map((item) => {
            const matched = industries.find(i => i.code === item.code);
            return (
              <button
                key={item.code}
                onClick={() => handleSelect(item.code)}
                className="group relative rounded-xl p-5 text-left border transition-all hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${item.color}12 0%, ${item.color}06 50%, transparent 100%)`,
                  borderColor: `${item.color}25`,
                }}
              >
                {matched && (
                  <span
                    className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-base font-semibold text-white/90 mb-0.5">{item.name}</h3>
                <p className="text-xs text-white/30 font-mono mb-3">{item.code}</p>
                <p className="text-xs text-white/40 mb-3 leading-relaxed">{item.description}</p>
                <div className="text-[10px] text-white/25 border-t border-white/5 pt-2">
                  <div className="text-white/20 mb-1 uppercase tracking-wider">CRM 生命周期</div>
                  {item.lifecycle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-white/20 mt-6">
          选择后将展示该行业下的全链路场景配置与行业能力库
        </p>
      </div>
    </div>
  );
}
