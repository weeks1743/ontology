import { useState, useEffect } from 'react';
import { useAbilityStore } from '../store/ability-store';
import TestCaseRunner from '../components/TestCaseRunner';

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
  }
];

export default function SkillTestPage() {
  const [activeTab, setActiveTab] = useState<'ontology' | 'external'>('ontology');
  const [ontologyTests, setOntologyTests] = useState<TestCase[]>(CRM_TEST_CASES);
  const [externalTests, setExternalTests] = useState<TestCase[]>(EXTERNAL_TEST_CASES);
  const { executeSkill } = useAbilityStore();

  const currentTests = activeTab === 'ontology' ? ontologyTests : externalTests;
  const setCurrentTests = activeTab === 'ontology' ? setOntologyTests : setExternalTests;

  const runTest = async (testCase: TestCase) => {
    // 更新状态为运行中
    setCurrentTests(tests =>
      tests.map(tc =>
        tc.id === testCase.id ? { ...tc, status: 'running' as const } : tc
      )
    );

    try {
      const startTime = Date.now();
      await executeSkill(testCase.skillId, testCase.params);

      // 从日志中获取结果
      const logs = await fetch('/api/logs?limit=1').then(r => r.json());
      const latestLog = logs[0];

      const duration = Date.now() - startTime;
      const success = latestLog?.status === 'success';

      // 更新测试结果
      setCurrentTests(tests =>
        tests.map(tc =>
          tc.id === testCase.id
            ? {
                ...tc,
                status: success ? 'passed' : 'failed',
                actualResult: latestLog?.output_result,
                error: latestLog?.error_message,
                duration
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
                duration: Date.now() - Date.now()
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
