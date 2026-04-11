CREATE (s1:SalesRep {id: 'sales_zhou_yu', name: '周宇', team: '华东大客户组', region: '华东', seniority: 'senior', ontology_id: 'crm'});

CREATE (s2:SalesRep {id: 'sales_tang_qing', name: '汤庆', team: '华北连锁餐饮组', region: '华北', seniority: 'senior', ontology_id: 'crm'});

CREATE (s3:SalesRep {id: 'sales_zhong_weiqin', name: '钟卫亲', team: '华东制造业组', region: '华东', seniority: 'mid', ontology_id: 'crm'});

CREATE (l1:Lead {id: 'lead_matsui', title: '上海松井机械 - 协同办公需求', source: '行业展会', status: 'converted', created_at: '2026-01-15', ontology_id: 'crm'});

CREATE (l2:Lead {id: 'lead_matsui_after_sales', title: '上海松井机械 - 售后工单系统', source: '客户转介绍', status: 'converted', created_at: '2026-02-10', ontology_id: 'crm'});

CREATE (l3:Lead {id: 'lead_jindeli', title: '山东金德利 - 门店管理需求', source: '老客户拓展', status: 'converted', created_at: '2026-01-20', ontology_id: 'crm'});

CREATE (l4:Lead {id: 'lead_jindeli_catering', title: '山东金德利 - 团餐订单系统', source: '运营部门引荐', status: 'qualified', created_at: '2026-02-28', ontology_id: 'crm'});

CREATE (l5:Lead {id: 'lead_jiuzhou', title: '江苏九州电器 - 售后协同需求', source: '客户主动咨询', status: 'converted', created_at: '2026-02-05', ontology_id: 'crm'});

CREATE (l6:Lead {id: 'lead_jiuzhou_prod', title: '江苏九州电器 - 生产协同平台', source: '售后试点延展', status: 'nurturing', created_at: '2026-03-15', ontology_id: 'crm'});

CREATE (c1:Customer {id: 'cust_matsui_sh', name: '上海松井机械有限公司', industry: '制造业', level: 'A', region: '华东', segment: '外资制造企业', digital_maturity: 'medium_high', status: 'active', ontology_id: 'crm'});

CREATE (c2:Customer {id: 'cust_jindeli_sd', name: '山东金德利餐饮集团有限公司', industry: '餐饮连锁/团餐', level: 'A', region: '华北', segment: '集团型连锁服务企业', digital_maturity: 'medium', status: 'active', ontology_id: 'crm'});

CREATE (c3:Customer {id: 'cust_jiuzhou_js', name: '江苏九州电器有限公司', industry: '电器制造', level: 'B', region: '华东', segment: '民营制造企业', digital_maturity: 'medium', status: 'observing', ontology_id: 'crm'});

CREATE (ct1:Contact {id: 'contact_matsui_it', name: '王振宇', role: '信息化经理', influence_level: 'high', attitude: 'positive', ontology_id: 'crm'});

CREATE (ct2:Contact {id: 'contact_matsui_fin', name: '赵丽', role: '财务负责人', influence_level: 'medium', attitude: 'cautious', ontology_id: 'crm'});

CREATE (ct3:Contact {id: 'contact_matsui_gm', name: '森田健', role: '总经理', influence_level: 'high', attitude: 'neutral', ontology_id: 'crm'});

CREATE (ct4:Contact {id: 'contact_jindeli_it', name: '孙涛', role: '信息部负责人', influence_level: 'high', attitude: 'positive', ontology_id: 'crm'});

CREATE (ct5:Contact {id: 'contact_jindeli_ops', name: '马会', role: '运营总监', influence_level: 'high', attitude: 'positive', ontology_id: 'crm'});

CREATE (ct6:Contact {id: 'contact_jindeli_fin', name: '刘敏', role: '财务经理', influence_level: 'medium', attitude: 'cautious', ontology_id: 'crm'});

CREATE (ct7:Contact {id: 'contact_jiuzhou_factory', name: '李强', role: '工厂厂长', influence_level: 'high', attitude: 'neutral', ontology_id: 'crm'});

CREATE (ct8:Contact {id: 'contact_jiuzhou_service', name: '陈雪', role: '售后负责人', influence_level: 'high', attitude: 'positive', ontology_id: 'crm'});

CREATE (ct9:Contact {id: 'contact_jiuzhou_gm', name: '周建国', role: '总经理', influence_level: 'high', attitude: 'cautious', ontology_id: 'crm'});

CREATE (o1:Opportunity {id: 'opp_matsui_01', name: '集团协同办公与流程一体化项目', stage: '需求分析', amount: 680000, probability: 55, close_date: '2026-06-30', ontology_id: 'crm'});

CREATE (o2:Opportunity {id: 'opp_matsui_02', name: '售后工单与设备服务协同试点', stage: '初步接触', amount: 180000, probability: 35, close_date: '2026-07-15', ontology_id: 'crm'});

CREATE (o3:Opportunity {id: 'opp_jindeli_01', name: '门店协同与督导巡检平台', stage: '方案提案', amount: 420000, probability: 65, close_date: '2026-05-28', ontology_id: 'crm'});

CREATE (o4:Opportunity {id: 'opp_jindeli_02', name: '团餐订单与供应链协同试点', stage: '需求分析', amount: 270000, probability: 50, close_date: '2026-06-20', ontology_id: 'crm'});

CREATE (o5:Opportunity {id: 'opp_jiuzhou_01', name: '生产与售后协同平台', stage: '初步接触', amount: 330000, probability: 40, close_date: '2026-07-08', ontology_id: 'crm'});

CREATE (o6:Opportunity {id: 'opp_jiuzhou_02', name: '售后派工与客户反馈闭环项目', stage: '需求分析', amount: 160000, probability: 55, close_date: '2026-06-25', ontology_id: 'crm'});

CREATE (q1:Quote {id: 'quote_jindeli_01', amount: 420000, status: 'submitted', submitted_at: '2026-04-01', ontology_id: 'crm'});

CREATE (q2:Quote {id: 'quote_jiuzhou_02', amount: 160000, status: 'draft', ontology_id: 'crm'});

CREATE (q3:Quote {id: 'quote_matsui_01', amount: 680000, status: 'preparing', ontology_id: 'crm'});

CREATE (v1:VisitRecord {id: 'visit_matsui_01', title: '首次需求摸底', sequence_no: 1, visit_at: '2026-03-09', ontology_id: 'crm'});

CREATE (v2:VisitRecord {id: 'visit_matsui_02', title: 'IT 与业务联合访谈', sequence_no: 2, visit_at: '2026-03-16', ontology_id: 'crm'});

CREATE (v3:VisitRecord {id: 'visit_matsui_03', title: '试点范围讨论', sequence_no: 3, visit_at: '2026-03-28', ontology_id: 'crm'});

CREATE (v4:VisitRecord {id: 'visit_jindeli_01', title: '总部调研', sequence_no: 1, visit_at: '2026-03-10', ontology_id: 'crm'});

CREATE (v5:VisitRecord {id: 'visit_jindeli_02', title: '运营场景细化', sequence_no: 2, visit_at: '2026-03-20', ontology_id: 'crm'});

CREATE (v6:VisitRecord {id: 'visit_jindeli_03', title: '方案评审会', sequence_no: 3, visit_at: '2026-04-02', ontology_id: 'crm'});

CREATE (v7:VisitRecord {id: 'visit_jiuzhou_01', title: '售后问题收集', sequence_no: 1, visit_at: '2026-03-11', ontology_id: 'crm'});

CREATE (v8:VisitRecord {id: 'visit_jiuzhou_02', title: '生产与售后联动访谈', sequence_no: 2, visit_at: '2026-03-22', ontology_id: 'crm'});

CREATE (v9:VisitRecord {id: 'visit_jiuzhou_03', title: '老板层面沟通', sequence_no: 3, visit_at: '2026-04-03', ontology_id: 'crm'});

CREATE (n1:Need {id: 'need_matsui_01', name: '跨工厂流程协同', priority: 'high', ontology_id: 'crm'});

CREATE (n2:Need {id: 'need_matsui_02', name: '权限分级与审计', priority: 'high', ontology_id: 'crm'});

CREATE (n3:Need {id: 'need_matsui_03', name: 'ERP/设备系统集成', priority: 'medium', ontology_id: 'crm'});

CREATE (n4:Need {id: 'need_jindeli_01', name: '门店巡检数字化', priority: 'high', ontology_id: 'crm'});

CREATE (n5:Need {id: 'need_jindeli_02', name: '总部到门店任务闭环', priority: 'high', ontology_id: 'crm'});

CREATE (n6:Need {id: 'need_jindeli_03', name: '团餐订单协同', priority: 'medium', ontology_id: 'crm'});

CREATE (n7:Need {id: 'need_jiuzhou_01', name: '售后工单统一管理', priority: 'high', ontology_id: 'crm'});

CREATE (n8:Need {id: 'need_jiuzhou_02', name: '客诉闭环追踪', priority: 'high', ontology_id: 'crm'});

CREATE (n9:Need {id: 'need_jiuzhou_03', name: '生产与售后协同', priority: 'medium', ontology_id: 'crm'});

CREATE (r1:Risk {id: 'risk_matsui_01', name: '外资审批链长', level: 'high', ontology_id: 'crm'});

CREATE (r2:Risk {id: 'risk_matsui_02', name: '集成成本不确定', level: 'medium', ontology_id: 'crm'});

CREATE (r3:Risk {id: 'risk_jindeli_01', name: '一线门店培训成本高', level: 'medium', ontology_id: 'crm'});

CREATE (r4:Risk {id: 'risk_jindeli_02', name: '移动端复杂导致落地受阻', level: 'high', ontology_id: 'crm'});

CREATE (r5:Risk {id: 'risk_jiuzhou_01', name: '客户价格敏感', level: 'high', ontology_id: 'crm'});

CREATE (r6:Risk {id: 'risk_jiuzhou_02', name: '管理层关注 ROI', level: 'high', ontology_id: 'crm'});

CREATE (m1:Commitment {id: 'commit_matsui_01', name: '客户提供接口清单', due_date: '2026-04-24', status: 'open', ontology_id: 'crm'});

CREATE (m2:Commitment {id: 'commit_matsui_02', name: '安排管理层评审', due_date: '2026-04-28', status: 'open', ontology_id: 'crm'});

CREATE (m3:Commitment {id: 'commit_jindeli_01', name: '提供 20 家门店清单', due_date: '2026-04-18', status: 'fulfilled', ontology_id: 'crm'});

CREATE (m4:Commitment {id: 'commit_jindeli_02', name: '确定试点门店负责人', due_date: '2026-04-22', status: 'open', ontology_id: 'crm'});

CREATE (m5:Commitment {id: 'commit_jiuzhou_01', name: '提供近三个月工单样本', due_date: '2026-04-19', status: 'fulfilled', ontology_id: 'crm'});

CREATE (m6:Commitment {id: 'commit_jiuzhou_02', name: '安排售后流程演示', due_date: '2026-04-23', status: 'open', ontology_id: 'crm'});

MATCH (a:SalesRep {id: 'sales_zhou_yu'}), (b:Customer {id: 'cust_matsui_sh'}) CREATE (a)-[:SERVES]->(b);

MATCH (a:SalesRep {id: 'sales_tang_qing'}), (b:Customer {id: 'cust_jindeli_sd'}) CREATE (a)-[:SERVES]->(b);

MATCH (a:SalesRep {id: 'sales_zhong_weiqin'}), (b:Customer {id: 'cust_jiuzhou_js'}) CREATE (a)-[:SERVES]->(b);

MATCH (a:Lead {id: 'lead_matsui'}), (b:Customer {id: 'cust_matsui_sh'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_matsui_after_sales'}), (b:Customer {id: 'cust_matsui_sh'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jindeli'}), (b:Customer {id: 'cust_jindeli_sd'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jindeli_catering'}), (b:Customer {id: 'cust_jindeli_sd'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jiuzhou'}), (b:Customer {id: 'cust_jiuzhou_js'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jiuzhou_prod'}), (b:Customer {id: 'cust_jiuzhou_js'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:SalesRep {id: 'sales_zhou_yu'}), (b:Lead {id: 'lead_matsui'}) CREATE (a)-[:OWNS]->(b);

MATCH (a:SalesRep {id: 'sales_zhou_yu'}), (b:Lead {id: 'lead_matsui_after_sales'}) CREATE (a)-[:OWNS]->(b);

MATCH (a:SalesRep {id: 'sales_tang_qing'}), (b:Lead {id: 'lead_jindeli'}) CREATE (a)-[:OWNS]->(b);

MATCH (a:SalesRep {id: 'sales_tang_qing'}), (b:Lead {id: 'lead_jindeli_catering'}) CREATE (a)-[:OWNS]->(b);

MATCH (a:SalesRep {id: 'sales_zhong_weiqin'}), (b:Lead {id: 'lead_jiuzhou'}) CREATE (a)-[:OWNS]->(b);

MATCH (a:SalesRep {id: 'sales_zhong_weiqin'}), (b:Lead {id: 'lead_jiuzhou_prod'}) CREATE (a)-[:OWNS]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:Contact {id: 'contact_matsui_it'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:Contact {id: 'contact_matsui_fin'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:Contact {id: 'contact_matsui_gm'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:Contact {id: 'contact_jindeli_it'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:Contact {id: 'contact_jindeli_ops'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:Contact {id: 'contact_jindeli_fin'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:Contact {id: 'contact_jiuzhou_factory'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:Contact {id: 'contact_jiuzhou_service'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:Contact {id: 'contact_jiuzhou_gm'}) CREATE (a)-[:HAS_CONTACT]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:HAS_OPPORTUNITY]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:Opportunity {id: 'opp_matsui_02'}) CREATE (a)-[:HAS_OPPORTUNITY]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:HAS_OPPORTUNITY]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:Opportunity {id: 'opp_jindeli_02'}) CREATE (a)-[:HAS_OPPORTUNITY]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:HAS_OPPORTUNITY]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:HAS_OPPORTUNITY]->(b);

MATCH (a:Lead {id: 'lead_matsui'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_matsui_after_sales'}), (b:Opportunity {id: 'opp_matsui_02'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jindeli'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jindeli_catering'}), (b:Opportunity {id: 'opp_jindeli_02'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jiuzhou'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Lead {id: 'lead_jiuzhou_prod'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:CONVERTED_TO]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:VisitRecord {id: 'visit_matsui_01'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:VisitRecord {id: 'visit_matsui_02'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_matsui_sh'}), (b:VisitRecord {id: 'visit_matsui_03'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:VisitRecord {id: 'visit_jindeli_01'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:VisitRecord {id: 'visit_jindeli_02'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_jindeli_sd'}), (b:VisitRecord {id: 'visit_jindeli_03'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:VisitRecord {id: 'visit_jiuzhou_01'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:VisitRecord {id: 'visit_jiuzhou_02'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:Customer {id: 'cust_jiuzhou_js'}), (b:VisitRecord {id: 'visit_jiuzhou_03'}) CREATE (a)-[:HAS_VISIT_RECORD]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_01'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Opportunity {id: 'opp_matsui_02'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_01'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Opportunity {id: 'opp_jindeli_02'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_01'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:RELATES_TO]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Quote {id: 'quote_jindeli_01'}) CREATE (a)-[:HAS_QUOTE]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Quote {id: 'quote_jiuzhou_02'}) CREATE (a)-[:HAS_QUOTE]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Quote {id: 'quote_matsui_01'}) CREATE (a)-[:HAS_QUOTE]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_01'}), (b:Need {id: 'need_matsui_01'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_01'}), (b:Need {id: 'need_matsui_02'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Need {id: 'need_matsui_03'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Need {id: 'need_matsui_01'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Need {id: 'need_matsui_02'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_01'}), (b:Need {id: 'need_jindeli_01'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_01'}), (b:Need {id: 'need_jindeli_02'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Need {id: 'need_jindeli_01'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Need {id: 'need_jindeli_03'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Need {id: 'need_jindeli_02'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_01'}), (b:Need {id: 'need_jiuzhou_01'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_01'}), (b:Need {id: 'need_jiuzhou_02'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Need {id: 'need_jiuzhou_03'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Need {id: 'need_jiuzhou_01'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Need {id: 'need_jiuzhou_02'}) CREATE (a)-[:MENTIONS_NEED]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Risk {id: 'risk_matsui_01'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Risk {id: 'risk_matsui_02'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Risk {id: 'risk_matsui_01'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Risk {id: 'risk_jindeli_01'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Risk {id: 'risk_jindeli_02'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Risk {id: 'risk_jindeli_02'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_01'}), (b:Risk {id: 'risk_jiuzhou_01'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Risk {id: 'risk_jiuzhou_02'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Risk {id: 'risk_jiuzhou_01'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Risk {id: 'risk_jiuzhou_02'}) CREATE (a)-[:MENTIONS_RISK]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Commitment {id: 'commit_matsui_01'}) CREATE (a)-[:HAS_COMMITMENT]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Commitment {id: 'commit_matsui_02'}) CREATE (a)-[:HAS_COMMITMENT]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Commitment {id: 'commit_jindeli_01'}) CREATE (a)-[:HAS_COMMITMENT]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Commitment {id: 'commit_jindeli_02'}) CREATE (a)-[:HAS_COMMITMENT]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_01'}), (b:Commitment {id: 'commit_jiuzhou_01'}) CREATE (a)-[:HAS_COMMITMENT]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Commitment {id: 'commit_jiuzhou_02'}) CREATE (a)-[:HAS_COMMITMENT]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_01'}), (b:Contact {id: 'contact_matsui_it'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Contact {id: 'contact_matsui_it'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_02'}), (b:Contact {id: 'contact_matsui_fin'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Contact {id: 'contact_matsui_gm'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_matsui_03'}), (b:Contact {id: 'contact_matsui_it'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_01'}), (b:Contact {id: 'contact_jindeli_it'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_01'}), (b:Contact {id: 'contact_jindeli_ops'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Contact {id: 'contact_jindeli_ops'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_02'}), (b:Contact {id: 'contact_jindeli_it'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Contact {id: 'contact_jindeli_fin'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jindeli_03'}), (b:Contact {id: 'contact_jindeli_ops'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_01'}), (b:Contact {id: 'contact_jiuzhou_service'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Contact {id: 'contact_jiuzhou_factory'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_02'}), (b:Contact {id: 'contact_jiuzhou_service'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:VisitRecord {id: 'visit_jiuzhou_03'}), (b:Contact {id: 'contact_jiuzhou_gm'}) CREATE (a)-[:MET_WITH]->(b);

MATCH (a:Contact {id: 'contact_matsui_it'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_matsui_it'}), (b:Opportunity {id: 'opp_matsui_02'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_matsui_fin'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_matsui_gm'}), (b:Opportunity {id: 'opp_matsui_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jindeli_it'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jindeli_ops'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jindeli_ops'}), (b:Opportunity {id: 'opp_jindeli_02'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jindeli_fin'}), (b:Opportunity {id: 'opp_jindeli_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jiuzhou_factory'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jiuzhou_service'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jiuzhou_service'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jiuzhou_gm'}), (b:Opportunity {id: 'opp_jiuzhou_02'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Contact {id: 'contact_jiuzhou_gm'}), (b:Opportunity {id: 'opp_jiuzhou_01'}) CREATE (a)-[:INVOLVED_IN]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Need {id: 'need_matsui_01'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Need {id: 'need_matsui_02'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Need {id: 'need_matsui_03'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_02'}), (b:Need {id: 'need_matsui_03'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Need {id: 'need_jindeli_01'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Need {id: 'need_jindeli_02'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_02'}), (b:Need {id: 'need_jindeli_03'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_01'}), (b:Need {id: 'need_jiuzhou_03'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Need {id: 'need_jiuzhou_01'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Need {id: 'need_jiuzhou_02'}) CREATE (a)-[:ADDRESSES]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Risk {id: 'risk_matsui_01'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Risk {id: 'risk_matsui_02'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_02'}), (b:Risk {id: 'risk_matsui_02'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Risk {id: 'risk_jindeli_01'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Risk {id: 'risk_jindeli_02'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_02'}), (b:Risk {id: 'risk_jindeli_01'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_01'}), (b:Risk {id: 'risk_jiuzhou_01'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_01'}), (b:Risk {id: 'risk_jiuzhou_02'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Risk {id: 'risk_jiuzhou_01'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Risk {id: 'risk_jiuzhou_02'}) CREATE (a)-[:HAS_RISK]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Commitment {id: 'commit_matsui_01'}) CREATE (a)-[:REQUIRES]->(b);

MATCH (a:Opportunity {id: 'opp_matsui_01'}), (b:Commitment {id: 'commit_matsui_02'}) CREATE (a)-[:REQUIRES]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Commitment {id: 'commit_jindeli_01'}) CREATE (a)-[:REQUIRES]->(b);

MATCH (a:Opportunity {id: 'opp_jindeli_01'}), (b:Commitment {id: 'commit_jindeli_02'}) CREATE (a)-[:REQUIRES]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Commitment {id: 'commit_jiuzhou_01'}) CREATE (a)-[:REQUIRES]->(b);

MATCH (a:Opportunity {id: 'opp_jiuzhou_02'}), (b:Commitment {id: 'commit_jiuzhou_02'}) CREATE (a)-[:REQUIRES]->(b);

MATCH (a:Need {id: 'need_matsui_01'}), (b:Need {id: 'need_matsui_02'}) CREATE (a)-[:RELATED_TO]->(b);

MATCH (a:Need {id: 'need_jindeli_01'}), (b:Need {id: 'need_jindeli_02'}) CREATE (a)-[:RELATED_TO]->(b);

MATCH (a:Need {id: 'need_jiuzhou_01'}), (b:Need {id: 'need_jiuzhou_02'}) CREATE (a)-[:RELATED_TO]->(b);

MATCH (a:Need {id: 'need_matsui_03'}), (b:Need {id: 'need_jiuzhou_03'}) CREATE (a)-[:RELATED_TO]->(b);
