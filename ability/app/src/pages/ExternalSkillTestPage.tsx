import { useState } from 'react';
import TestCaseRunner from '../components/TestCaseRunner';

async function executeExternalSkill(skillId: string, params: any) {
  const res = await fetch(`/api/v2/skills/${skillId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to execute skill: ${res.statusText}`);
  }
  return data;
}

function extractHtmlContent(raw: string): string | null {
  if (!raw) return null;

  const mdMatch = raw.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (mdMatch) {
    const extracted = mdMatch[1].trim();
    if (/<(?:html|body|!doctype)/i.test(extracted)) return extracted;
  }

  const htmlMatch = raw.match(/<(!doctype|html)[\s\S]*<\/html>/i);
  if (htmlMatch) return htmlMatch[0];

  const bodyMatch = raw.match(/<body[\s\S]*<\/body>/i);
  if (bodyMatch) {
    return `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n${bodyMatch[0]}\n</html>`;
  }

  return null;
}

interface ExternalTestCase {
  id: string;
  name: string;
  description: string;
  skillId: string;
  params: any;
  status: 'pending' | 'running' | 'passed' | 'failed';
  actualResult?: any;
  error?: string;
  duration?: number;
  htmlUrl?: string;
  htmlContent?: string;
  progress?: string;
}

const INITIAL_TEST_CASES: ExternalTestCase[] = [
  {
    id: 'EXT001',
    name: '百度搜索',
    description: '测试百度搜索功能',
    skillId: 'baidu-search',
    params: {
      query: '人工智能最新进展',
      limit: 5,
    },
    status: 'pending',
  },
  {
    id: 'EXT002',
    name: '生成销售报告',
    description: '测试报告生成器 - 销售报告',
    skillId: 'kai-report-creator',
    params: {
      template: 'sales_report',
      data: {
        period: '2026-Q1',
        total_revenue: 5000000,
        opportunities: 25,
        conversion_rate: 0.35,
      },
      format: 'markdown',
    },
    status: 'pending',
  },
  {
    id: 'EXT003',
    name: '生成商机分析报告',
    description: '测试报告生成器 - 商机分析',
    skillId: 'kai-report-creator',
    params: {
      template: 'opportunity_analysis',
      data: {
        title: '大客户 CRM 项目',
        amount: 800000,
        stage: 'proposal',
        probability: 70,
        customer_name: '测试科技有限公司',
      },
      format: 'markdown',
    },
    status: 'pending',
  },
  {
    id: 'EXT004',
    name: '生成公司研究报告（HTML）',
    description: '测试报告生成器 - 公司研究报告（松井机械案例）',
    skillId: 'kai-report-creator',
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
          '定制化系统工程项目进度、交付、成本管控不透明',
        ],
        cooperation_suggestions: '建议立即启动需求对接，本周内联系公司IT部门与核心业务负责人；基于调研结果，1周内提交定制化试点方案，突出跨区域协作、合规管控、数据集成三大核心能力',
        risks: [
          { type: '决策流程', level: '中', description: '外资企业总部决策层级多，推进周期长' },
          { type: '系统集成', level: '中高', description: '与现有生产设备系统、ERP系统对接存在技术壁垒' },
          { type: '员工接受度', level: '低', description: '生产现场员工对新工具可能存在抵触' },
        ],
        summary: '松井机械作为规范运营、技术领先、付费能力强的外资制造企业，其协同办公核心痛点与SaaS产品能力高度匹配，具备快速落地、深度合作、长期增值的三重潜力。',
        report_author: '协同办公SaaS厂商销售',
      },
      format: 'html',
    },
    status: 'pending',
  },
  {
    id: 'EXT005',
    name: '火山方舟联网搜索',
    description: '测试火山方舟 Web Search - 搜索大模型领域最新进展',
    skillId: 'volcengine-web-search',
    params: {
      query: '大模型领域最近有什么热门的科技新闻？火山方舟最近发布了什么新模型',
      max_keyword: 3,
      limit: 10,
      sources: ['douyin', 'toutiao', 'moji'],
    },
    status: 'pending',
  },
  {
    id: 'EXT006',
    name: '生成产品发布幻灯片（HTML）',
    description: '测试幻灯片生成器 - 生成一份产品发布演示文稿（5页，含封面、痛点、方案、数据、结尾）',
    skillId: 'kai-slide-creator',
    params: {
      command: '--generate',
      topic: '协同办公 SaaS 产品发布会',
      style: 'aurora-mesh',
      language: 'zh-CN',
      slides: [
        { type: 'cover', title: 'AIFlux 协同办公平台', subtitle: '让协作更智能，让工作更高效', date: '2026年4月' },
        { type: 'pain-point', title: '企业协作痛点', points: ['跨部门沟通成本高', '数据孤岛严重', '远程协作效率低', '信息安全难保障'] },
        { type: 'solution', title: 'AIFlux 解决方案', features: ['智能工作流引擎', '实时协同编辑', '全链路数据打通', '企业级权限管控'] },
        { type: 'data', title: '客户成效', metrics: [{ label: '协作效率提升', value: '65%' }, { label: '沟通成本降低', value: '40%' }, { label: '项目交付加速', value: '2x' }] },
        { type: 'closing', title: '开启智能协作新时代', subtitle: '联系我们：contact@aiflux.com', cta: '立即预约演示' },
      ],
      output_format: 'html',
    },
    status: 'pending',
  },
];

export default function ExternalSkillTestPage() {
  const [tests, setTests] = useState<ExternalTestCase[]>(INITIAL_TEST_CASES);

  const runTest = async (testCase: ExternalTestCase) => {
    const runId = testCase.id;

    const updateTc = (patch: Partial<ExternalTestCase>) => {
      setTests(prev => prev.map(tc => tc.id === runId ? { ...tc, ...patch } : tc));
    };

    updateTc({ status: 'running', htmlUrl: undefined, htmlContent: undefined, progress: '正在执行...', duration: undefined });

    const startTime = Date.now();
    const timerRef = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      updateTc({ progress: `正在执行... (${elapsed}s)` });
    }, 1000);

    try {
      const result = await executeExternalSkill(testCase.skillId, testCase.params);
      const duration = Date.now() - startTime;
      clearInterval(timerRef);

      const success = result.success;
      const output = result.spawnOutput;
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

      let htmlContent: string | undefined;
      let htmlUrl: string | undefined;

      const extractedHtml = extractHtmlContent(outputStr);
      if (success && extractedHtml) {
        htmlContent = extractedHtml;
        try {
          const saveRes = await fetch('/api/v2/skills/save-html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: extractedHtml, testId: testCase.id, skillId: testCase.skillId }),
          });
          const saveData = await saveRes.json();
          if (saveRes.ok && saveData.url) {
            htmlUrl = saveData.url;
          } else {
            const blob = new Blob([extractedHtml], { type: 'text/html' });
            htmlUrl = URL.createObjectURL(blob);
          }
        } catch {
          const blob = new Blob([extractedHtml], { type: 'text/html' });
          htmlUrl = URL.createObjectURL(blob);
        }
      }

      updateTc({
        status: success ? 'passed' : 'failed',
        actualResult: output ? { format: htmlUrl ? 'html' : 'text', length: outputStr.length, preview: outputStr.substring(0, 500) } : undefined,
        error: result.error,
        duration,
        htmlUrl,
        htmlContent,
        progress: undefined,
      });
    } catch (error) {
      clearInterval(timerRef);
      updateTc({
        status: 'failed',
        error: (error as Error).message,
        duration: Date.now() - startTime,
        progress: undefined,
      });
    }
  };

  const runAllTests = async () => {
    for (const testCase of tests) {
      await runTest(testCase);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">外部技能测试</h1>
          <p className="text-sm text-white/40 mt-1">运行外部技能测试用例（百度搜索、报告生成、幻灯片等）</p>
        </div>

        <TestCaseRunner
          testCases={tests}
          onRunTest={runTest}
          onRunAll={runAllTests}
        />
      </div>
    </div>
  );
}
