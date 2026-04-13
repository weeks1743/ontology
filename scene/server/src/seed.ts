import type { SceneDb } from "./db.js";
import { stringifyJson } from "./db.js";
import {
  ensureOntology,
  createIndustry,
  createScenario,
  createSection,
  createBinding,
  createTestCase,
  getIndustries,
  getScenarios,
} from "./repository.js";

export function seedMockData(db: SceneDb, ontologyId: string, ontologyName: string) {
  // Ensure ontology exists
  const ontology = ensureOntology(db, ontologyId, ontologyName);

  // Check if already seeded
  const existing = getIndustries(db, ontology.id);
  if (existing.length > 0) return;

  const now = new Date().toISOString();

  // ═══════════════════════════════════════════════════════════
  // IT Industry (信息技术)
  // ═══════════════════════════════════════════════════════════
  const itIndustry = createIndustry(db, {
    scene_ontology_id: ontology.id,
    code: "IT",
    name: "信息技术",
    description: "企业软件、云服务、数字化转型",
    icon: "💻",
    color: "#3B82F6",
    display_order: 0,
    is_active: 1,
  });

  // --- Scenario 1: 信息化评估 ---
  const itScenario1 = createScenario(db, {
    industry_id: itIndustry.id,
    code: "IT_ASSESSMENT",
    name: "信息化评估",
    description: "全面评估企业信息化现状，识别管理痛点，输出建设方案建议",
    trigger_context: { input_type: "audio", purpose: "it_assessment", output_format: "pptx" },
    display_order: 0,
    is_active: 1,
  });

  const itS1_sec1 = createSection(db, {
    scenario_id: itScenario1.id,
    code: "INFO_STATUS",
    name: "信息化现状分析",
    description: "梳理企业现有IT系统、数据流转、技术架构，识别核心痛点与瓶颈",
    prompt_template: "分析 {{company_name}} 的信息化现状：\n1. 现有系统架构和核心业务系统\n2. 数据流转和集成现状\n3. 主要业务痛点和效率瓶颈\n4. 技术债务和遗留系统风险",
    example_content: "当前使用传统ERP系统，财务与资产数据未打通，固定资产管理依赖Excel手工录入，账实不符现象严重。供应链系统与销售系统割裂，库存周转数据需人工汇总。",
    display_order: 0, is_required: 1,
  });
  const itS1_sec2 = createSection(db, {
    scenario_id: itScenario1.id,
    code: "INFO_OUTPUT",
    name: "信息化产出分析",
    description: "量化评估信息化投入产出效率，分析系统使用率、数据质量与业务协同效果",
    prompt_template: "评估 {{company_name}} 的信息化产出能力：\n1. 系统使用率和用户活跃度\n2. 数据质量和完整性分析\n3. 业务协同效率提升评估\n4. 信息化投入产出比(ROI)分析",
    example_content: "核心ERP系统日均活跃用户仅45%，财务模块使用率最高(78%)，资产管理模块使用率不足20%。数据质量问题突出：供应商主数据重复率18%，物料编码不规范率32%。",
    display_order: 1, is_required: 1,
  });
  const itS1_sec3 = createSection(db, {
    scenario_id: itScenario1.id,
    code: "INFO_RECOMMEND",
    name: "信息化升级建议",
    description: "基于现状与产出分析，输出分阶段、可落地的信息化升级路线图",
    prompt_template: "基于 {{company_name}} 的现状与产出评估，提供升级建议：\n1. 优先级排序：按投入产出比排列升级项目\n2. 短期速赢方案（3-6个月）：解决核心瓶颈\n3. 中期升级路径（6-12个月）：打通数据孤岛，提升协同\n4. 长期演进愿景（1-3年）：构建数字化平台，支撑业务创新",
    example_content: "短期优先：部署固定资产管理模块解决账实不符（预估3个月上线）。中期升级：打通ERP与供应链数据流，统一主数据管理。长期演进：构建数据中台，实现业务全链路数字化。总投入预估200-350万元，预计2年内ROI超过150%。",
    display_order: 2, is_required: 1,
  });

  // ── Skill bindings: all 3 sections share the same PERCEPTIVE behavior
  createBinding(db, {
    section_id: itS1_sec1.id, skill_id: "ont.crm.visit_record_analyze", skill_name: "分析拜访记录",
    input_mapping: { visit_record_id: "{{visit_record.id}}" },
    output_mapping: { content: "{{skill_output.summary}}" }, execution_order: 0, is_active: 1,
  });
  createBinding(db, {
    section_id: itS1_sec2.id, skill_id: "ont.crm.visit_record_analyze", skill_name: "分析拜访记录",
    input_mapping: { visit_record_id: "{{visit_record.id}}" },
    output_mapping: { content: "{{skill_output.key_signals}}" }, execution_order: 0, is_active: 1,
  });
  createBinding(db, {
    section_id: itS1_sec3.id, skill_id: "ont.crm.visit_record_analyze", skill_name: "分析拜访记录",
    input_mapping: { visit_record_id: "{{visit_record.id}}" },
    output_mapping: { content: "{{skill_output.sentiment}}" }, execution_order: 0, is_active: 1,
  });

  createTestCase(db, {
    scenario_id: itScenario1.id, name: "东港集团信息化评估",
    description: "测试IT行业信息化评估场景",
    mock_input: { audio_file: "donggang_visit.mp3", company_name: "东港集团", visit_date: "2026-04-10" },
    expected_sections: ["INFO_STATUS", "INFO_OUTPUT", "INFO_RECOMMEND"],
  });

  // --- Scenario 2: 竞品分析报告 ---
  const itScenario2 = createScenario(db, {
    industry_id: itIndustry.id,
    code: "COMPETITOR_ANALYSIS",
    name: "竞品分析报告",
    description: "分析客户竞品，输出对比报告",
    trigger_context: { input_type: "text", purpose: "competitor_analysis", output_format: "docx" },
    display_order: 1,
    is_active: 1,
  });

  const itS2_sec1 = createSection(db, {
    scenario_id: itScenario2.id,
    code: "COMPETITOR_OVERVIEW",
    name: "竞品概况",
    description: "竞品基本信息和市场定位",
    prompt_template: "分析竞品 {{competitor_name}} 的基本情况：\n1. 产品功能和定位\n2. 目标市场和用户群体\n3. 技术架构和优势\n4. 定价策略和市场份额",
    example_content: "竞品A是一款企业级CRM系统，采用SaaS模式，主要面向中小企业，市场占有率约15%。",
    display_order: 0, is_required: 1,
  });
  const itS2_sec2 = createSection(db, {
    scenario_id: itScenario2.id,
    code: "FEATURE_COMPARISON",
    name: "功能对比分析",
    description: "与竞品的功能差异对比",
    prompt_template: "对比我方产品与 {{competitor_name}} 的功能差异：\n1. 核心功能对比\n2. 用户体验对比\n3. 性能和稳定性对比\n4. 集成和扩展能力对比",
    example_content: "我方产品在数据分析方面领先，但竞品在移动端体验上更优。",
    display_order: 1, is_required: 1,
  });
  const itS2_sec3 = createSection(db, {
    scenario_id: itScenario2.id,
    code: "COMPETITIVE_STRATEGY",
    name: "竞争策略建议",
    description: "基于竞品分析的应对策略",
    prompt_template: "基于竞品分析，制定竞争策略：\n1. 差异化定位建议\n2. 功能改进优先级\n3. 市场策略调整\n4. 客户沟通话术建议",
    example_content: "建议强化数据分析优势，针对重视商业智能的客户重点推广。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: itScenario2.id, name: "CRM竞品对比分析",
    description: "测试IT行业竞品分析报告生成",
    mock_input: { competitor_name: "Salesforce", focus_areas: ["analytics", "integration", "pricing"] },
    expected_sections: ["COMPETITOR_OVERVIEW", "FEATURE_COMPARISON", "COMPETITIVE_STRATEGY"],
  });

  // --- Scenario 3: 客户续约评估 ---
  const itScenario3 = createScenario(db, {
    industry_id: itIndustry.id,
    code: "RENEWAL_ASSESSMENT",
    name: "客户续约评估",
    description: "评估客户续约意向和风险",
    trigger_context: { input_type: "data", purpose: "renewal_assessment", output_format: "pptx" },
    display_order: 2,
    is_active: 1,
  });

  const itS3_sec1 = createSection(db, {
    scenario_id: itScenario3.id,
    code: "USAGE_ANALYSIS",
    name: "产品使用情况",
    description: "客户产品使用频率、模块使用率",
    prompt_template: "分析客户 {{company_name}} 的产品使用情况：\n1. 各模块使用频率和活跃度\n2. 用户登录和采用率趋势\n3. 功能使用深度和广度\n4. 未充分利用的功能模块",
    example_content: "客户核心模块使用率85%，但高级分析模块仅12%用户使用，存在较大提升空间。",
    display_order: 0, is_required: 1,
  });
  const itS3_sec2 = createSection(db, {
    scenario_id: itScenario3.id,
    code: "RISK_ASSESSMENT",
    name: "续约风险评估",
    description: "识别续约风险因素和预警信号",
    prompt_template: "评估客户 {{company_name}} 的续约风险：\n1. 使用活跃度趋势\n2. 客户满意度指标\n3. 竞品渗透风险\n4. 预算和决策人变动",
    example_content: "风险等级：中等。客户使用率下降15%，且有竞品POC在进行中。",
    display_order: 1, is_required: 1,
  });
  const itS3_sec3 = createSection(db, {
    scenario_id: itScenario3.id,
    code: "RENEWAL_STRATEGY",
    name: "续约策略建议",
    description: "提高续约成功率的策略建议",
    prompt_template: "制定客户 {{company_name}} 的续约策略：\n1. 续约时间点和关键节点\n2. 增值服务和优惠方案\n3. 客户关系维护计划\n4. 风险应对预案",
    example_content: "建议在到期前90天启动续约流程，提供15%续约折扣+免费培训套餐。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: itScenario3.id, name: "东港集团续约评估",
    description: "测试IT行业客户续约评估报告生成",
    mock_input: { company_name: "东港集团", contract_end: "2026-12-31", annual_value: 500000 },
    expected_sections: ["USAGE_ANALYSIS", "RISK_ASSESSMENT", "RENEWAL_STRATEGY"],
  });

  // ═══════════════════════════════════════════════════════════
  // Biology Industry (生物医药)
  // ═══════════════════════════════════════════════════════════
  const bioIndustry = createIndustry(db, {
    scene_ontology_id: ontology.id,
    code: "BIOLOGY",
    name: "生物医药",
    description: "疫苗、药品、医疗器械销售",
    icon: "🧬",
    color: "#10B981",
    display_order: 1,
    is_active: 1,
  });

  // --- Scenario 1: 科室推介方案 ---
  const bioScenario1 = createScenario(db, {
    industry_id: bioIndustry.id,
    code: "DEPT_PRESENTATION",
    name: "科室推介方案",
    description: "面向目标科室的产品推介",
    trigger_context: { input_type: "audio", purpose: "dept_promotion", output_format: "pptx" },
    display_order: 0,
    is_active: 1,
  });

  const bioS1_sec1 = createSection(db, {
    scenario_id: bioScenario1.id,
    code: "HOSPITAL_OVERVIEW",
    name: "医疗机构概况",
    description: "医院背景、科室设置、患者群体",
    prompt_template: "基于医疗机构名称 {{company_name}}，总结基本信息：\n1. 机构类型和等级\n2. 重点科室和专科特色\n3. 年门诊量和住院量\n4. 目标患者群体",
    example_content: "某三甲医院，设有心血管内科、肿瘤科等重点科室，年门诊量超过100万人次。",
    display_order: 0, is_required: 1,
  });
  const bioS1_sec2 = createSection(db, {
    scenario_id: bioScenario1.id,
    code: "PRODUCT_PORTFOLIO",
    name: "产品组合分析",
    description: "现有产品线、市场定位、竞争态势",
    prompt_template: "分析 {{company_name}} 的产品组合现状：\n1. 当前使用的药品和器械\n2. 供应商和采购渠道\n3. 产品满意度和痛点\n4. 竞品对比分析",
    example_content: "目前主要使用进口药品，成本较高。部分科室反馈国产替代品质量参差不齐。",
    display_order: 1, is_required: 1,
  });
  const bioS1_sec3 = createSection(db, {
    scenario_id: bioScenario1.id,
    code: "CLINICAL_NEEDS",
    name: "临床需求分析",
    description: "目标科室、患者群体、治疗方案",
    prompt_template: "识别 {{company_name}} 的临床需求和痛点：\n1. 重点科室的治疗需求\n2. 患者群体特征和用药习惯\n3. 现有治疗方案的局限性\n4. 未满足的临床需求",
    example_content: "心血管科需要更有效的抗凝药物，肿瘤科希望引入靶向治疗方案。",
    display_order: 2, is_required: 1,
  });
  const bioS1_sec4 = createSection(db, {
    scenario_id: bioScenario1.id,
    code: "SOLUTION_PROPOSAL",
    name: "解决方案建议",
    description: "产品推荐、配送方案、售后服务",
    prompt_template: "提供针对性的生物医药解决方案：\n1. 推荐产品和规格\n2. 价格方案和支付条款\n3. 配送和库存管理\n4. 学术支持和培训服务",
    example_content: "推荐XX抗凝药物，临床数据显示疗效优于现有方案。提供冷链配送服务。",
    display_order: 3, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: bioScenario1.id, name: "三甲医院心血管科推介",
    description: "测试生物医药行业科室推介方案生成",
    mock_input: { company_name: "某三甲医院", department: "心血管内科" },
    expected_sections: ["HOSPITAL_OVERVIEW", "PRODUCT_PORTFOLIO", "CLINICAL_NEEDS", "SOLUTION_PROPOSAL"],
  });

  // --- Scenario 2: 学术会议报告 ---
  const bioScenario2 = createScenario(db, {
    industry_id: bioIndustry.id,
    code: "CONFERENCE_REPORT",
    name: "学术会议报告",
    description: "学术会议场景的方案展示",
    trigger_context: { input_type: "text", purpose: "conference", output_format: "pptx" },
    display_order: 1,
    is_active: 1,
  });

  const bioS2_sec1 = createSection(db, {
    scenario_id: bioScenario2.id,
    code: "RESEARCH_BACKGROUND",
    name: "研究背景",
    description: "疾病领域现状、未满足需求",
    prompt_template: "概述 {{disease_area}} 领域的研究背景：\n1. 疾病流行病学数据\n2. 当前治疗指南和标准\n3. 未满足的临床需求\n4. 研究热点和趋势",
    example_content: "心血管疾病是全球首要死因，中国约有2.9亿患者，现有治疗方案仍有较大改善空间。",
    display_order: 0, is_required: 1,
  });
  const bioS2_sec2 = createSection(db, {
    scenario_id: bioScenario2.id,
    code: "CLINICAL_EVIDENCE",
    name: "临床证据展示",
    description: "临床试验数据、疗效和安全性",
    prompt_template: "展示 {{product_name}} 的临床证据：\n1. 主要研究终点数据\n2. 次要研究终点数据\n3. 安全性分析\n4. 亚组分析结果",
    example_content: "III期临床显示，主要终点达标（p<0.001），不良事件发生率低于对照组。",
    display_order: 1, is_required: 1,
  });
  const bioS2_sec3 = createSection(db, {
    scenario_id: bioScenario2.id,
    code: "EXPERT_CONSENSUS",
    name: "专家共识与指南",
    description: "国内外指南推荐、专家意见",
    prompt_template: "总结 {{product_name}} 的指南和共识推荐：\n1. 国内外权威指南推荐级别\n2. 专家共识推荐意见\n3. 医保目录和准入情况\n4. 临床应用建议",
    example_content: "该产品已被ESC/EAS指南列为I类推荐，2025版医保目录乙类报销。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: bioScenario2.id, name: "心血管领域学术会议报告",
    description: "测试生物医药学术会议报告生成",
    mock_input: { disease_area: "心血管疾病", product_name: "XX抗凝药物", conference: "CSC 2026" },
    expected_sections: ["RESEARCH_BACKGROUND", "CLINICAL_EVIDENCE", "EXPERT_CONSENSUS"],
  });

  // --- Scenario 3: 医保准入方案 ---
  const bioScenario3 = createScenario(db, {
    industry_id: bioIndustry.id,
    code: "INSURANCE_ACCESS",
    name: "医保准入方案",
    description: "医保目录准入申请材料",
    trigger_context: { input_type: "data", purpose: "insurance_access", output_format: "docx" },
    display_order: 2,
    is_active: 1,
  });

  const bioS3_sec1 = createSection(db, {
    scenario_id: bioScenario3.id,
    code: "PHARMACOECONOMICS",
    name: "药物经济学评估",
    description: "成本效果分析、预算影响分析",
    prompt_template: "对 {{product_name}} 进行药物经济学评估：\n1. 成本效果分析(CEA)\n2. 预算影响分析(BIA)\n3. 质量调整生命年(QALY)计算\n4. 与现有治疗的经济性对比",
    example_content: "CEA显示ICER为45,000元/QALY，低于3倍人均GDP阈值，具有成本效果优势。",
    display_order: 0, is_required: 1,
  });
  const bioS3_sec2 = createSection(db, {
    scenario_id: bioScenario3.id,
    code: "CLINICAL_VALUE",
    name: "临床价值论证",
    description: "临床优势、患者获益",
    prompt_template: "论证 {{product_name}} 的临床价值：\n1. 与标准治疗的疗效对比\n2. 患者预后改善数据\n3. 特殊人群获益\n4. 公共卫生价值",
    example_content: "相比标准治疗，主要心血管事件风险降低23%，患者年住院次数减少1.5次。",
    display_order: 1, is_required: 1,
  });
  const bioS3_sec3 = createSection(db, {
    scenario_id: bioScenario3.id,
    code: "ACCESS_STRATEGY",
    name: "准入策略建议",
    description: "谈判策略、价格建议",
    prompt_template: "制定 {{product_name}} 的医保准入策略：\n1. 目标医保目录类别（甲类/乙类）\n2. 谈判价格区间建议\n3. 风险分担方案设计\n4. 谈判关键论据准备",
    example_content: "建议申请乙类目录，谈判价格区间为XX-XX元/盒，可设计按疗效付费方案。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: bioScenario3.id, name: "XX抗凝药物医保准入方案",
    description: "测试生物医药医保准入方案生成",
    mock_input: { product_name: "XX抗凝药物", target_year: "2027", current_price: 128 },
    expected_sections: ["PHARMACOECONOMICS", "CLINICAL_VALUE", "ACCESS_STRATEGY"],
  });

  // ═══════════════════════════════════════════════════════════
  // Food Industry (食品饮料)
  // ═══════════════════════════════════════════════════════════
  const foodIndustry = createIndustry(db, {
    scene_ontology_id: ontology.id,
    code: "FOOD",
    name: "食品饮料",
    description: "快消品、餐饮供应链、食品加工",
    icon: "🍜",
    color: "#F59E0B",
    display_order: 2,
    is_active: 1,
  });

  // --- Scenario 1: 供应链优化方案 ---
  const foodScenario1 = createScenario(db, {
    industry_id: foodIndustry.id,
    code: "SUPPLY_OPTIMIZATION",
    name: "供应链优化方案",
    description: "供应链数字化升级方案",
    trigger_context: { input_type: "audio", purpose: "supply_optimization", output_format: "pptx" },
    display_order: 0,
    is_active: 1,
  });

  const foodS1_sec1 = createSection(db, {
    scenario_id: foodScenario1.id,
    code: "COMPANY_OVERVIEW",
    name: "客户基本情况",
    description: "企业背景、产品线、市场覆盖",
    prompt_template: "基于食品企业名称 {{company_name}}，总结基本信息：\n1. 企业规模和发展历程\n2. 主要产品线和品牌\n3. 销售渠道和市场份额\n4. 生产基地和产能",
    example_content: "某区域性饮料企业，主营果汁和茶饮料，年产能5万吨。产品覆盖华东地区。",
    display_order: 0, is_required: 1,
  });
  const foodS1_sec2 = createSection(db, {
    scenario_id: foodScenario1.id,
    code: "SUPPLY_CHAIN",
    name: "供应链现状",
    description: "采购、仓储、配送体系分析",
    prompt_template: "分析 {{company_name}} 的供应链管理现状：\n1. 原料采购和供应商管理\n2. 仓储设施和库存周转\n3. 物流配送网络和效率\n4. 供应链痛点和瓶颈",
    example_content: "原料采购依赖季节性供应，库存波动大。仓储设施老旧，缺乏温控系统。",
    display_order: 1, is_required: 1,
  });
  const foodS1_sec3 = createSection(db, {
    scenario_id: foodScenario1.id,
    code: "OPTIMIZATION_PLAN",
    name: "优化方案设计",
    description: "数字化升级方案和实施路径",
    prompt_template: "设计 {{company_name}} 的供应链优化方案：\n1. 数字化采购平台建设\n2. 智能仓储管理系统\n3. 配送路线优化算法\n4. 全链路追溯体系",
    example_content: "建议分三阶段实施：先部署ERP系统打通数据，再引入WMS仓储管理，最后实现全链路追溯。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: foodScenario1.id, name: "区域饮料企业供应链优化",
    description: "测试食品饮料供应链优化方案生成",
    mock_input: { company_name: "某饮料企业", focus: "supply_chain" },
    expected_sections: ["COMPANY_OVERVIEW", "SUPPLY_CHAIN", "OPTIMIZATION_PLAN"],
  });

  // --- Scenario 2: 新品上市推广 ---
  const foodScenario2 = createScenario(db, {
    industry_id: foodIndustry.id,
    code: "PRODUCT_LAUNCH",
    name: "新品上市推广",
    description: "新品上市市场推广方案",
    trigger_context: { input_type: "text", purpose: "product_launch", output_format: "pptx" },
    display_order: 1,
    is_active: 1,
  });

  const foodS2_sec1 = createSection(db, {
    scenario_id: foodScenario2.id,
    code: "MARKET_RESEARCH",
    name: "市场调研分析",
    description: "目标市场、竞品、消费者洞察",
    prompt_template: "分析新品 {{product_name}} 的市场环境：\n1. 目标市场规模和增速\n2. 竞品格局和差异化定位\n3. 消费者画像和需求洞察\n4. 渠道特征和进入壁垒",
    example_content: "无糖茶饮市场年增速35%，主要竞品有三得利、东方树叶，消费者以25-35岁都市白领为主。",
    display_order: 0, is_required: 1,
  });
  const foodS2_sec2 = createSection(db, {
    scenario_id: foodScenario2.id,
    code: "LAUNCH_STRATEGY",
    name: "上市策略",
    description: "产品定位、定价、渠道策略",
    prompt_template: "制定 {{product_name}} 的上市策略：\n1. 产品定位和核心卖点\n2. 定价策略和利润模型\n3. 渠道布局和首批铺货\n4. 区域试点和推广节奏",
    example_content: "定位高端无糖茶饮，定价6-8元，首批进入华东一二线城市便利店和精品超市。",
    display_order: 1, is_required: 1,
  });
  const foodS2_sec3 = createSection(db, {
    scenario_id: foodScenario2.id,
    code: "MARKETING_PLAN",
    name: "营销推广计划",
    description: "品牌传播、促销活动",
    prompt_template: "设计 {{product_name}} 的营销推广计划：\n1. 品牌传播策略和渠道\n2. 上市活动规划\n3. 社交媒体营销方案\n4. 促销活动和消费者互动",
    example_content: "通过小红书种草+抖音KOL合作进行预热，上市首月在重点城市举办线下体验活动。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: foodScenario2.id, name: "无糖茶饮料新品上市方案",
    description: "测试食品饮料新品上市推广方案生成",
    mock_input: { product_name: "XX无糖茶饮", target_market: "华东", price_range: "6-8元" },
    expected_sections: ["MARKET_RESEARCH", "LAUNCH_STRATEGY", "MARKETING_PLAN"],
  });

  // --- Scenario 3: 品控体系方案 ---
  const foodScenario3 = createScenario(db, {
    industry_id: foodIndustry.id,
    code: "QUALITY_SYSTEM",
    name: "品控体系方案",
    description: "食品安全品控体系建设方案",
    trigger_context: { input_type: "text", purpose: "quality_system", output_format: "docx" },
    display_order: 2,
    is_active: 1,
  });

  const foodS3_sec1 = createSection(db, {
    scenario_id: foodScenario3.id,
    code: "CURRENT_ASSESSMENT",
    name: "品控现状评估",
    description: "质量管理体系和合规性评估",
    prompt_template: "评估 {{company_name}} 的品控体系现状：\n1. 质量管理体系和认证\n2. 食品安全控制措施\n3. 合规性和追溯能力\n4. 品控痛点和改进空间",
    example_content: "已通过ISO22000认证，但追溯系统不完善。部分生产环节依赖人工检测。",
    display_order: 0, is_required: 1,
  });
  const foodS3_sec2 = createSection(db, {
    scenario_id: foodScenario3.id,
    code: "RISK_CONTROL",
    name: "风险管控方案",
    description: "风险识别、预警和处置机制",
    prompt_template: "设计 {{company_name}} 的风险管控方案：\n1. 关键控制点(CCP)识别\n2. 风险预警指标体系\n3. 应急处置预案\n4. 供应商风险管理",
    example_content: "识别5个关键控制点：原料验收、杀菌温度、包装密封性、仓储温度、运输时效。",
    display_order: 1, is_required: 1,
  });
  const foodS3_sec3 = createSection(db, {
    scenario_id: foodScenario3.id,
    code: "DIGITAL_QC",
    name: "数字化品控平台",
    description: "品控信息化系统建设",
    prompt_template: "规划 {{company_name}} 的数字化品控平台：\n1. 品控数据采集系统\n2. 全链路追溯平台\n3. 智能检测和设备联网\n4. 数据分析和报表看板",
    example_content: "建设IoT品控中台，实现生产线传感器数据实时采集、异常自动预警、批次全追溯。",
    display_order: 2, is_required: 1,
  });

  createTestCase(db, {
    scenario_id: foodScenario3.id, name: "饮料企业品控体系建设方案",
    description: "测试食品饮料品控体系方案生成",
    mock_input: { company_name: "某饮料企业", certification: "ISO22000", production_lines: 4 },
    expected_sections: ["CURRENT_ASSESSMENT", "RISK_CONTROL", "DIGITAL_QC"],
  });

  console.log(`✅ Seeded mock data for ontology: ${ontologyName}`);
  console.log(`   - 3 industries: IT, Biology, Food`);
  console.log(`   - 9 scenarios (3 per industry) with content sections`);
  console.log(`   - Skill bindings and test cases per scenario`);
}
