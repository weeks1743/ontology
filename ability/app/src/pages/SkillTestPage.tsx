import { useState } from 'react';
import { skillsApi } from '../api/client';
import TestCaseRunner from '../components/TestCaseRunner';

// 本体技能用旧 API（后端业务逻辑），外部技能用 v2 API（LLM 执行）
async function executeSkillByType(skillId: string, params: any) {
  // 本体技能（ont.*）→ 旧 API
  if (skillId.startsWith('ont.')) {
    const result = await skillsApi.execute(skillId, params);
    return {
      success: result.success,
      spawnOutput: result.data,
      error: result.error,
      durationMs: result.duration_ms,
    };
  }
  // 外部技能（ext.*）→ v2 API（LLM 执行）
  const res = await fetch(`/api/v2/skills/${skillId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params }),
  });
  if (!res.ok) throw new Error(`Failed to execute skill: ${res.statusText}`);
  return res.json();
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  skillId: string;
  params: any;
  expectedResult?: any;
  status: 'pending' | 'running' | 'passed' | 'failed';
  actualResult?: any;
  error?: string;
  duration?: number;
  htmlUrl?: string;
  htmlContent?: string;
}

// CRM 业务流程测试用例
const CRM_TEST_CASES: TestCase[] = [
  {
    id: 'UC001',
    name: '创建线索（规则通过）',
    description: '创建线索，提供 title + phone，规则校验通过',
    skillId: 'ont.create_lead',
    params: {
      title: '测试线索-大客户',
      phone: '13800138000',
      source: '网站推广',
      owner: '张三'
    },
    status: 'pending'
  },
  {
    id: 'UC002',
    name: '创建线索（缺电话阻断）',
    description: '创建线索，缺少 phone 字段，规则校验阻断',
    skillId: 'ont.create_lead',
    params: {
      title: '测试线索-无电话'
    },
    status: 'pending',
    expectedResult: { success: false, error: '缺少必填字段: phone' }
  },
  {
    id: 'UC003',
    name: '补全线索（预算达标）',
    description: '补全线索信息，预算 >= 1万，规则通过',
    skillId: 'ont.complete_lead',
    params: {
      lead_id: 'test-lead-001',
      budget: 50000,
      requirements: '需要 CRM 系统'
    },
    status: 'pending'
  },
  {
    id: 'UC004',
    name: '补全线索（预算不足阻断）',
    description: '补全线索信息，预算 < 1万，规则阻断',
    skillId: 'ont.complete_lead',
    params: {
      lead_id: 'test-lead-002',
      budget: 5000,
      requirements: '小型项目'
    },
    status: 'pending',
    expectedResult: { success: false, error: '预算不足：线索预算必须 >= 1万元' }
  },
  {
    id: 'UC005',
    name: '评估线索',
    description: '评估线索质量，设置评分和优先级',
    skillId: 'ont.evaluate_lead',
    params: {
      lead_id: 'test-lead-001',
      score: 85,
      priority: 'high'
    },
    status: 'pending'
  },
  {
    id: 'UC006',
    name: '线索转商机',
    description: '线索转商机，自动创建客户、联系人、商机',
    skillId: 'ont.convert_lead',
    params: {
      lead_id: 'test-lead-001',
      customer_name: '测试科技有限公司',
      contact_name: '李经理',
      contact_phone: '13900139000',
      opportunity_title: '测试商机-CRM项目',
      amount: 500000
    },
    status: 'pending'
  },
  {
    id: 'UC007',
    name: '创建商机（概率合法）',
    description: '创建商机，概率在 0-100 之间，规则通过',
    skillId: 'ont.create_opportunity',
    params: {
      title: '测试商机-ERP项目',
      amount: 800000,
      probability: 60,
      customer_id: 'test-customer-001'
    },
    status: 'pending'
  },
  {
    id: 'UC008',
    name: '创建商机（概率越界阻断）',
    description: '创建商机，概率 > 100，规则阻断',
    skillId: 'ont.create_opportunity',
    params: {
      title: '测试商机-越界',
      amount: 100000,
      probability: 150
    },
    status: 'pending',
    expectedResult: { success: false, error: '概率越界：商机概率必须在 0-100 之间' }
  },
  {
    id: 'UC009',
    name: '推进商机阶段',
    description: '推进商机到下一阶段，更新概率',
    skillId: 'ont.advance_opportunity',
    params: {
      opportunity_id: 'test-opp-001',
      stage: 'proposal',
      probability: 70
    },
    status: 'pending'
  },
  {
    id: 'UC010',
    name: '创建报价单（50万内免审批）',
    description: '创建报价单，金额 <= 50万，无需审批',
    skillId: 'ont.create_quote',
    params: {
      opportunity_id: 'test-opp-001',
      amount: 400000,
      items: ['CRM系统', '实施服务']
    },
    status: 'pending'
  },
  {
    id: 'UC011',
    name: '创建报价单（超额需审批阻断）',
    description: '创建报价单，金额 > 50万，需要审批阻断',
    skillId: 'ont.create_quote',
    params: {
      opportunity_id: 'test-opp-002',
      amount: 600000,
      items: ['ERP系统', '定制开发']
    },
    status: 'pending',
    expectedResult: { success: false, error: '超额报价须审批：报价金额 > 50万需要提交审批' }
  },
  {
    id: 'UC012',
    name: '提交报价审批',
    description: '提交报价单审批，更新状态为待审批',
    skillId: 'ont.submit_quote',
    params: {
      quote_id: 'test-quote-001'
    },
    status: 'pending'
  },
  {
    id: 'UC013',
    name: '审批通过赢单',
    description: '审批通过报价单，更新商机状态为赢单',
    skillId: 'ont.approve_quote',
    params: {
      quote_id: 'test-quote-001',
      opportunity_id: 'test-opp-001'
    },
    status: 'pending'
  }
];

// 外部技能测试用例
const EXTERNAL_TEST_CASES: TestCase[] = [
  {
    id: 'EXT001',
    name: '百度搜索',
    description: '测试百度搜索功能',
    skillId: 'ext.baidu_search',
    params: {
      query: '人工智能最新进展',
      limit: 5
    },
    status: 'pending'
  },
  {
    id: 'EXT002',
    name: '生成销售报告',
    description: '测试报告生成器 - 销售报告',
    skillId: 'ext.kai_report_creator',
    params: {
      template: 'sales_report',
      data: {
        period: '2026-Q1',
        total_revenue: 5000000,
        opportunities: 25,
        conversion_rate: 0.35
      },
      format: 'markdown'
    },
    status: 'pending'
  },
  {
    id: 'EXT003',
    name: '生成商机分析报告',
    description: '测试报告生成器 - 商机分析',
    skillId: 'ext.kai_report_creator',
    params: {
      template: 'opportunity_analysis',
      data: {
        title: '大客户 CRM 项目',
        amount: 800000,
        stage: 'proposal',
        probability: 70,
        customer_name: '测试科技有限公司'
      },
      format: 'markdown'
    },
    status: 'pending'
  },
  {
    id: 'EXT004',
    name: '生成公司研究报告（HTML）',
    description: '测试报告生成器 - 公司研究报告（松井机械案例）',
    skillId: 'ext.kai_report_creator',
    params: {
      template: 'company_research_report',
      data: {
        company_name: '上海松井机械有限公司',
        report_date: '2026年04月03日',
        core_conclusion: '上海松井机械有限公司作为日本松井制作所100%控股的外资制造企业，具备规范的管理体系、稳定的经营状况、明确的数字化升级需求，是协同办公SaaS产品的优质目标客户。',
        full_name: '上海松井机械有限公司',
        established_date: '1997年06月03日',
        company_type: '有限责任公司（外国法人独资）',
        registered_capital: '1026万美元',
        business_status: '存续',
        employee_count: '121人（2024年数据）',
        org_structure: '兼具生产制造、销售服务、技术研发职能，为松井全球重要生产基地与中国区运营总部',
        management_features: '外资背景，管理流程规范，重视合规与权限管控，跨部门协作需求明确',
        tax_credit: '连续2年（2023、2024）获评A级',
        ip_count: 28,
        licenses: 16,
        core_business: '塑料成型辅助机械专业制造商，核心业务覆盖注塑机周边设备研发、生产、销售与系统集成',
        industry_position: '母公司松井制作所全球销售额排名第二、日本第一，在华布局超30年，拥有13个国内据点',
        core_advantages: '技术积淀：百年行业经验，拥有28项专利；客户覆盖：服务汽车、电子电气、医疗等多领域头部客户；绿色理念：推行Factor4环保理念',
        key_findings: [
          '跨部门协同效率低，定制化方案沟通周期长',
          '与日本总部跨时区协作低效，国内多据点业务联动不顺畅',
          '设备运行数据、生产进度、售后数据与管理系统独立',
          '外资企业需严格权限分级，专利、客户数据等敏感信息需隔离',
          '定制化系统工程项目进度、交付、成本管控不透明'
        ],
        cooperation_suggestions: '建议立即启动需求对接，本周内联系公司IT部门与核心业务负责人；基于调研结果，1周内提交定制化试点方案，突出跨区域协作、合规管控、数据集成三大核心能力',
        risks: [
          { type: '决策流程', level: '中', description: '外资企业总部决策层级多，推进周期长' },
          { type: '系统集成', level: '中高', description: '与现有生产设备系统、ERP系统对接存在技术壁垒' },
          { type: '员工接受度', level: '低', description: '生产现场员工对新工具可能存在抵触' }
        ],
        summary: '松井机械作为规范运营、技术领先、付费能力强的外资制造企业，其协同办公核心痛点与SaaS产品能力高度匹配，具备快速落地、深度合作、长期增值的三重潜力。',
        report_author: '协同办公SaaS厂商销售'
      },
      format: 'html'
    },
    status: 'pending'
  },
  {
    id: 'EXT005',
    name: '火山方舟联网搜索',
    description: '测试火山方舟 Web Search - 搜索大模型领域最新进展',
    skillId: 'ext.volcengine_web_search',
    params: {
      query: '大模型领域最近有什么热门的科技新闻？火山方舟最近发布了什么新模型',
      max_keyword: 3,
      limit: 10,
      sources: ['douyin', 'toutiao', 'moji']
    },
    status: 'pending'
  }
];

export default function SkillTestPage() {
  const [activeTab, setActiveTab] = useState<'ontology' | 'external'>('ontology');
  const [ontologyTests, setOntologyTests] = useState<TestCase[]>(CRM_TEST_CASES);
  const [externalTests, setExternalTests] = useState<TestCase[]>(EXTERNAL_TEST_CASES);

  const currentTests = activeTab === 'ontology' ? ontologyTests : externalTests;
  const setCurrentTests = activeTab === 'ontology' ? setOntologyTests : setExternalTests;

  const runTest = async (testCase: TestCase) => {
    // 更新状态为运行中
    setCurrentTests(tests =>
      tests.map(tc =>
        tc.id === testCase.id ? { ...tc, status: 'running' as const, htmlUrl: undefined, htmlContent: undefined } : tc
      )
    );

    try {
      const startTime = Date.now();
      const result = await executeSkillByType(testCase.skillId, testCase.params);
      const duration = Date.now() - startTime;

      const success = result.success;
      let htmlUrl: string | undefined;

      // 从 spawnOutput 中提取内容
      const output = result.spawnOutput;
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

      // 检测是否为 HTML 输出
      let htmlContent: string | undefined;
      if (success && outputStr && outputStr.includes('<!DOCTYPE html')) {
        htmlContent = outputStr;
        const blob = new Blob([outputStr], { type: 'text/html' });
        htmlUrl = URL.createObjectURL(blob);
      }

      setCurrentTests(tests =>
        tests.map(tc =>
          tc.id === testCase.id
            ? {
                ...tc,
                status: success ? 'passed' : 'failed',
                actualResult: output ? { format: htmlUrl ? 'html' : 'text', length: outputStr.length, preview: outputStr.substring(0, 500) } : undefined,
                error: result.error,
                duration,
                htmlUrl,
                htmlContent
              }
            : tc
        )
      );
    } catch (error) {
      setCurrentTests(tests =>
        tests.map(tc =>
          tc.id === testCase.id
            ? {
                ...tc,
                status: 'failed',
                error: (error as Error).message,
                duration: 0
              }
            : tc
        )
      );
    }
  };

  const runAllTests = async () => {
    for (const testCase of currentTests) {
      await runTest(testCase);
      // 短暂延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <div className="h-full overflow-auto bg-space-darker">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">技能测试</h1>
          <p className="text-gray-400 mt-2">运行测试用例验证技能功能</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('ontology')}
            className={`px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'ontology'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'glass-effect text-gray-300 hover:bg-white/5'
            }`}
          >
            本体技能测试 ({ontologyTests.length})
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'external'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'glass-effect text-gray-300 hover:bg-white/5'
            }`}
          >
            外部技能测试 ({externalTests.length})
          </button>
        </div>

        {/* 测试用例运行器 */}
        <TestCaseRunner
          testCases={currentTests}
          onRunTest={runTest}
          onRunAll={runAllTests}
        />
      </div>
    </div>
  );
}
