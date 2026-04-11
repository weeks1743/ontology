import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { skillsApi, ontologySkillsApi, mockDataApi, eventBusApi } from '../api/client';
import { useAbilityStore } from '../store/ability-store';
import { Skill } from '../types';

const API_BASE = '/api';
const SPEAKER_ALIAS_STORAGE_KEY = 'ability-speaker-aliases-v1';

type EventChainEntry = {
  eventCode: string;
  subscriberSkill: string;
  status: 'dispatched' | 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  chainId?: string;
};

type AdviceEntry = {
  round_no: number;
  current_assessment: string;
  recommended_actions: string[];
  evidence_summary: string;
  change_since_last_round: string;
  advice_markdown_url?: string;
  advice_html_url?: string;
  render_status?: string;
  llm_advice?: any;
};

type ProfileScenario = 'interview' | 'crm_visit';

type ProfileAnalysisResult = {
  scenario: ProfileScenario;
  prompt: string;
  markdown: string;
  markdownUrl: string;
  detectedSpeakers: string[];
  appliedAliases: Record<string, string>;
};

function detectSpeakers(text: string): string[] {
  const speakers = new Set<string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const labelMatch = line.match(/^([A-Za-z\u4e00-\u9fa5]{1,16}|发言人\d+|Speaker\s*\d+)(?:\s+\d{1,2}:\d{2})?\s*[:：]/);
    if (labelMatch) {
      speakers.add(labelMatch[1].trim());
      continue;
    }

    const participantMatch = line.match(/^-\s*([A-Za-z\u4e00-\u9fa5]{1,16})(?:（[^）]+）)?$/);
    if (participantMatch) {
      speakers.add(participantMatch[1].trim());
    }
  }
  return Array.from(speakers);
}

function loadGlobalSpeakerAliases(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(SPEAKER_ALIAS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGlobalSpeakerAliases(aliases: Record<string, string>) {
  window.localStorage.setItem(SPEAKER_ALIAS_STORAGE_KEY, JSON.stringify(aliases));
}

export default function SkillTestPage() {
  const { currentOntologyId, currentOntology } = useAbilityStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);

  const [showClearRuntimeConfirm, setShowClearRuntimeConfirm] = useState(false);
  const [clearingRuntime, setClearingRuntime] = useState(false);
  const [clearRuntimeResult, setClearRuntimeResult] = useState<any>(null);

  // New state: customer-driven
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerContext, setCustomerContext] = useState<any>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);

  // Skill IDs
  const [ontologySkillMap, setOntologySkillMap] = useState<Record<string, string>>({});
  const [hardcodedSkillMap, setHardcodedSkillMap] = useState<Record<string, string>>({});

  // Event chain state
  const [eventChain, setEventChain] = useState<EventChainEntry[]>([]);
  const [, setActiveChainId] = useState<string>('');

  // Advice state
  const [adviceList, setAdviceList] = useState<AdviceEntry[]>([]);

  // Upload state
  const [uploadingMarkdown, setUploadingMarkdown] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [createResult, setCreateResult] = useState<any>(null);

  // Profile analysis state
  const [profileScenario, setProfileScenario] = useState<ProfileScenario>('crm_visit');
  const [selectedVisitRecordId, setSelectedVisitRecordId] = useState<string>('');
  const [selectedVisitRecordContent, setSelectedVisitRecordContent] = useState<string>('');
  const [interviewTranscript, setInterviewTranscript] = useState('');
  const [speakerAliases, setSpeakerAliases] = useState<Record<string, string>>({});
  const [globalSpeakerAliases, setGlobalSpeakerAliases] = useState<Record<string, string>>({});
  const [activeSpeaker, setActiveSpeaker] = useState('');
  const [speakerAliasDraft, setSpeakerAliasDraft] = useState('');
  const [profileGenerating, setProfileGenerating] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileResult, setProfileResult] = useState<ProfileAnalysisResult | null>(null);

  // Loading skill map on mount
  useEffect(() => {
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (ontologyCode) {
      skillsApi.getAll(ontologyCode)
        .then((skills: Skill[]) => {
          const nextMap: Record<string, string> = {};
          for (const skill of skills) {
            if (skill.category !== 'ontology') continue;
            if (skill.skill_slug) nextMap[skill.skill_slug] = skill.id;
          }
          setOntologySkillMap(nextMap);
        })
        .catch(() => setOntologySkillMap({}));
    }
    // Load hardcoded skill IDs
    fetch(`${API_BASE}/skills/hardcoded`)
      .then(res => res.json())
      .then(data => setHardcodedSkillMap(data.skills || {}))
      .catch(() => setHardcodedSkillMap({}));
  }, [currentOntologyId, currentOntology]);

  // Load customers
  const loadCustomers = async () => {
    try {
      const data = await mockDataApi.getCustomers();
      setCustomers(data.customers || []);
      if (data.customers?.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data.customers[0].id);
      }
    } catch (e) {
      console.warn('Failed to load customers (data not initialized?):', (e as Error).message);
    }
  };

  // Initialize seed data
  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await mockDataApi.init();
      setSeedResult(result);
      await loadCustomers();
    } catch (e) {
      setSeedResult({ error: (e as Error).message });
    } finally {
      setSeeding(false);
    }
  };

  // Load customers on mount to detect existing data
  useEffect(() => {
    loadCustomers();
    setGlobalSpeakerAliases(loadGlobalSpeakerAliases());
  }, []);

  // Load customer context when selection changes
  useEffect(() => {
    if (!selectedCustomerId) return;
    mockDataApi.getCustomerContext(selectedCustomerId)
      .then(ctx => setCustomerContext(ctx))
      .catch(() => setCustomerContext(null));
  }, [selectedCustomerId]);

  // Load advice for selected customer
  const loadAdviceDirect = async () => {
    try {
      const res = await fetch(`${API_BASE}/mock-data/customers/${selectedCustomerId}/advice`);
      if (!res.ok) return;
      const data = await res.json();
      const entries: AdviceEntry[] = (data.artifacts || []).map((a: any) => ({
        round_no: a.round_no,
        current_assessment: a.current_assessment,
        recommended_actions: a.recommended_actions,
        evidence_summary: a.evidence_summary,
        change_since_last_round: a.change_since_last_round,
        advice_markdown_url: a.advice_markdown_path ? `/tmp${a.advice_markdown_path.split('/tmp')[1]}` : undefined,
        advice_html_url: a.advice_html_path ? `/tmp${a.advice_html_path.split('/tmp')[1]}` : undefined,
        render_status: a.render_status || 'success',
        llm_advice: a.llm_advice || undefined,
      }));
      setAdviceList(entries);
    } catch {}
  };

  useEffect(() => {
    if (!selectedCustomerId) {
      setAdviceList([]);
      return;
    }
    mockDataApi.getCustomerAdvice(selectedCustomerId)
      .then(data => {
        const entries: AdviceEntry[] = (data.artifacts || []).map((a: any) => ({
          round_no: a.round_no,
          current_assessment: a.current_assessment,
          recommended_actions: a.recommended_actions,
          evidence_summary: a.evidence_summary,
          change_since_last_round: a.change_since_last_round,
          advice_markdown_url: a.advice_markdown_path ? `/tmp${a.advice_markdown_path.split('/tmp')[1]}` : undefined,
          advice_html_url: a.advice_html_path ? `/tmp${a.advice_html_path.split('/tmp')[1]}` : undefined,
          render_status: a.render_status || 'success',
          llm_advice: a.llm_advice || undefined,
        }));
        setAdviceList(entries);
      })
      .catch(() => setAdviceList([]));
  }, [selectedCustomerId]);

  useEffect(() => {
    const latestVisitRecordId = customerContext?.visit_records?.[customerContext.visit_records.length - 1]?.id || '';
    setSelectedVisitRecordId(latestVisitRecordId);
  }, [customerContext?.visit_records, selectedCustomerId]);

  useEffect(() => {
    if (!selectedVisitRecordId) {
      setSelectedVisitRecordContent('');
      return;
    }
    mockDataApi.getVisitRecord(selectedVisitRecordId)
      .then((record) => setSelectedVisitRecordContent(record.content_markdown || ''))
      .catch(() => setSelectedVisitRecordContent(''));
  }, [selectedVisitRecordId]);

  const profileTranscript = profileScenario === 'crm_visit' ? selectedVisitRecordContent : interviewTranscript;
  const detectedSpeakers = useMemo(() => detectSpeakers(profileTranscript), [profileTranscript]);

  useEffect(() => {
    if (detectedSpeakers.length === 0) {
      setActiveSpeaker('');
      setSpeakerAliasDraft('');
      return;
    }

    setSpeakerAliases((prev) => {
      const next = { ...prev };
      for (const speaker of detectedSpeakers) {
        if (!next[speaker] && globalSpeakerAliases[speaker]) {
          next[speaker] = globalSpeakerAliases[speaker];
        }
      }
      return next;
    });

    setActiveSpeaker((prev) => (prev && detectedSpeakers.includes(prev) ? prev : detectedSpeakers[0]));
  }, [detectedSpeakers, globalSpeakerAliases]);

  useEffect(() => {
    if (!activeSpeaker) {
      setSpeakerAliasDraft('');
      return;
    }
    setSpeakerAliasDraft(speakerAliases[activeSpeaker] || globalSpeakerAliases[activeSpeaker] || '');
  }, [activeSpeaker, speakerAliases, globalSpeakerAliases]);

  // Poll for advice render status (when any advice is still generating)
  useEffect(() => {
    const hasGenerating = adviceList.some(a => a.render_status === 'generating');
    if (!hasGenerating || !selectedCustomerId) return;

    const pollInterval = setInterval(() => {
      mockDataApi.getCustomerAdvice(selectedCustomerId)
        .then(data => {
          const entries: AdviceEntry[] = (data.artifacts || []).map((a: any) => ({
            round_no: a.round_no,
            current_assessment: a.current_assessment,
            recommended_actions: a.recommended_actions,
            evidence_summary: a.evidence_summary,
            change_since_last_round: a.change_since_last_round,
            advice_markdown_url: a.advice_markdown_path ? `/tmp${a.advice_markdown_path.split('/tmp')[1]}` : undefined,
            advice_html_url: a.advice_html_path ? `/tmp${a.advice_html_path.split('/tmp')[1]}` : undefined,
            render_status: a.render_status || 'success',
            llm_advice: a.llm_advice || undefined,
          }));
          setAdviceList(entries);
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, adviceList.length, adviceList.some(a => a.render_status)]);  // Handle markdown file upload and trigger CreateFromMarkdown
  const handleMarkdownUpload = async (file: File) => {
    if (!selectedCustomerId) return;

    const content = await file.text();
    setMarkdownPreview(content);
    setUploadingMarkdown(true);
    setUploadError('');
    setCreateResult(null);
    setEventChain([]);

    const createSkillId = ontologySkillMap['visit_record_create_from_markdown'] || ontologySkillMap['visitrecord_create_from_markdown'] || hardcodedSkillMap['visit_record.create_from_markdown'];
    if (!createSkillId) {
      setUploadError('找不到 VisitRecord.CreateFromMarkdown 技能，请先 Build 本体技能');
      setUploadingMarkdown(false);
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    const sequenceNo = (customerContext?.visit_records?.length || 0) + 1;

    try {
      const result = await ontologySkillsApi.executeSkill(createSkillId, {
        customer_id: selectedCustomerId,
        customer_name: customer?.name || '',
        title: `第${sequenceNo}次拜访`,
        sequence_no: sequenceNo,
        visit_type: 'uploaded_markdown',
        content_markdown: content,
        visit_at: new Date().toISOString().split('T')[0],
        source_channel: 'uploaded_markdown',
        industry: customer?.industry || '',
        region: customer?.region || '',
      });

      if (!result.success) {
        throw new Error(result.error || '创建拜访记录失败');
      }

      setCreateResult(result.data);
      setActiveChainId(result.data?.chain_id || '');

      // Start monitoring event chain
      monitorEventChain(result.data?.chain_id || '');
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploadingMarkdown(false);
    }
  };

  // Monitor event chain progression
  const monitorEventChain = async (chainId: string) => {
    if (!chainId) return;

    setEventChain([
      { eventCode: 'visit_record.created', subscriberSkill: '拜访记录分析', status: 'dispatched', chainId },
    ]);

    // Expected chain steps for CRM
    const CHAIN_STEPS = [
      { eventCode: 'visit_record.created', label: '拜访记录分析', nextEvent: 'visit_record.analyzed' },
      { eventCode: 'visit_record.analyzed', label: '生成客户经营建议', nextEvent: null },
    ];

    // Poll for chain logs
    const pollInterval = setInterval(async () => {
      try {
        const chainData = await eventBusApi.getChainLogs(chainId);
        const logs = chainData.logs || [];

        if (logs.length === 0) {
          // Still waiting for first event bus log
          setEventChain([
            { eventCode: 'visit_record.created', subscriberSkill: '拜访记录分析', status: 'running', chainId },
          ]);
          return;
        }

        // Build entries from actual logs with Chinese labels
        const entries: EventChainEntry[] = logs.map((log: any) => {
          const step = CHAIN_STEPS.find(s => s.eventCode === log.event_code);
          return {
            eventCode: log.event_code,
            subscriberSkill: step?.label || log.subscriber_behavior_code || log.subscriber_skill_id,
            status: log.status === 'success' ? 'completed' : 'error',
            result: log.output_result ? JSON.parse(log.output_result) : undefined,
            error: log.error_message || undefined,
            chainId: log.chain_id,
          };
        });

        // Check if there's a next expected step that's still pending
        const lastLog = logs[logs.length - 1];
        const stepDef = CHAIN_STEPS.find(s => s.eventCode === lastLog.event_code);
        if (stepDef?.nextEvent && lastLog.status === 'success') {
          // Next step should be running
          const nextStep = CHAIN_STEPS.find(s => s.eventCode === stepDef.nextEvent);
          if (nextStep && !logs.some((l: any) => l.event_code === stepDef.nextEvent)) {
            entries.push({ eventCode: stepDef.nextEvent, subscriberSkill: nextStep.label, status: 'running', chainId });
          }
        }

        setEventChain(entries);

        // Stop polling when all expected steps have completed
        const completedEvents = logs.filter((l: any) => l.status === 'success').map((l: any) => l.event_code);
        const lastChainStep = CHAIN_STEPS[CHAIN_STEPS.length - 1];
        if (completedEvents.includes(lastChainStep.eventCode)) {
          clearInterval(pollInterval);
          // Wait for async advice generation to complete (renderViaReportCreator + artifact insert)
          setTimeout(() => {
            loadAdviceDirect();
            if (selectedCustomerId) {
              mockDataApi.getCustomerContext(selectedCustomerId).then(ctx => setCustomerContext(ctx)).catch(() => {});
            }
          }, 3000);
        }
      } catch {
        // Poll silently fails
      }
    }, 1500);

    // Stop polling after 60s
    setTimeout(() => clearInterval(pollInterval), 60000);
  };

  const handleClearData = async () => {
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (!ontologyCode) return;
    setClearing(true);
    try {
      const result = await ontologySkillsApi.clearData(ontologyCode);
      setClearResult(result);
      setShowClearConfirm(false);
      await loadCustomers();
    } catch (error) {
      alert('清空数据失败: ' + (error as Error).message);
    } finally {
      setClearing(false);
    }
  };

  const handleClearRuntimeData = async () => {
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (!ontologyCode) return;
    setClearingRuntime(true);
    try {
      const result = await ontologySkillsApi.clearRuntimeData(ontologyCode);
      setClearRuntimeResult(result);
      setShowClearRuntimeConfirm(false);
      setAdviceList([]);
      setEventChain([]);
      if (selectedCustomerId) {
        mockDataApi.getCustomerContext(selectedCustomerId).then(ctx => setCustomerContext(ctx)).catch(() => {});
      }
    } catch (error) {
      alert('清空运行数据失败: ' + (error as Error).message);
    } finally {
      setClearingRuntime(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedVisitRecord = customerContext?.visit_records?.find((record: any) => record.id === selectedVisitRecordId);

  const applySingleSpeakerAlias = () => {
    if (!activeSpeaker || !speakerAliasDraft.trim()) return;
    setSpeakerAliases((prev) => ({ ...prev, [activeSpeaker]: speakerAliasDraft.trim() }));
  };

  const applyGlobalSpeakerAlias = () => {
    if (!activeSpeaker || !speakerAliasDraft.trim()) return;
    const alias = speakerAliasDraft.trim();
    setSpeakerAliases((prev) => ({ ...prev, [activeSpeaker]: alias }));
    setGlobalSpeakerAliases((prev) => {
      const next = { ...prev, [activeSpeaker]: alias };
      saveGlobalSpeakerAliases(next);
      return next;
    });
  };

  const handleAnalyzeProfile = async () => {
    if (!profileTranscript.trim()) {
      setProfileError('请先准备好用于画像分析的录音转写内容');
      return;
    }

    setProfileGenerating(true);
    setProfileError('');
    setProfileResult(null);

    try {
      const result = await mockDataApi.analyzeProfile({
        scenario: profileScenario,
        transcript: profileTranscript,
        speaker_aliases: speakerAliases,
        customer_id: profileScenario === 'crm_visit' ? selectedCustomerId : undefined,
        customer_name: profileScenario === 'crm_visit' ? selectedCustomer?.name : undefined,
        visit_record_id: profileScenario === 'crm_visit' ? selectedVisitRecordId : undefined,
        visit_title: profileScenario === 'crm_visit' ? selectedVisitRecord?.title : undefined,
      });
      setProfileResult(result);
    } catch (error) {
      setProfileError((error as Error).message);
    } finally {
      setProfileGenerating(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">CRM 感知型技能测试</h1>
            <p className="text-sm text-white/40 mt-1">事件链驱动 · LLM 建议 · 实例驱动</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSeed}
              disabled={seeding || customers.length > 0}
              className={`px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 ${
                customers.length > 0
                  ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                  : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
              }`}
            >
              {seeding ? '初始化中...' : customers.length > 0 ? '数据已就绪' : '初始化测试数据'}
            </button>
            <button
              onClick={() => setShowClearRuntimeConfirm(true)}
              disabled={customers.length === 0}
              className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 text-sm disabled:opacity-30"
            >
              清空运行数据
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
            >
              清空全部数据
            </button>
          </div>
        </div>

        {seedResult && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <p className="text-sm text-cyan-300">
              {seedResult.error ? `初始化失败: ${seedResult.error}` : `数据初始化成功 — MongoDB: ${seedResult.counts?.mongo_documents} 文档, Neo4j: ${seedResult.counts?.neo4j_statements} 语句, ChromaDB: ${seedResult.counts?.chroma_documents} 文档, 拜访记录: ${seedResult.counts?.visit_records}`}
            </p>
          </div>
        )}

        {/* Customer Selector */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">客户实例选择</h2>
          {customers.length === 0 ? (
            <p className="text-sm text-white/40">请先点击"初始化测试数据"加载 3 家客户实例</p>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`px-4 py-3 rounded-xl border text-left text-sm transition ${
                    selectedCustomerId === c.id
                      ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-white/40 mt-0.5">{c.industry} / {c.region}</div>
                </button>
              ))}
            </div>
          )}

          {/* Customer Overview Panel */}
          {customerContext && selectedCustomer && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="rounded-xl border border-white/10 bg-[#111214] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">客户主档</p>
                <p className="text-white font-medium mt-2">{customerContext.customer?.customer_name}</p>
                <p className="text-xs text-white/50 mt-1">{customerContext.customer?.industry} / {customerContext.customer?.region}</p>
                <p className="text-xs text-white/40 mt-1">负责人: {customerContext.customer?.owner_sales}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#111214] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">联系人 ({customerContext.contacts?.length || 0})</p>
                <div className="space-y-1 mt-2">
                  {(customerContext.contacts || []).slice(0, 3).map((c: any) => (
                    <div key={c.id} className="text-xs text-white/60">{c.name} — {c.role} <span className="text-white/30">({c.attitude})</span></div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#111214] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">商机 ({customerContext.opportunities?.length || 0})</p>
                <div className="space-y-1 mt-2">
                  {(customerContext.opportunities || []).slice(0, 3).map((o: any) => (
                    <div key={o.id} className="text-xs text-white/60">{o.name} <span className="text-emerald-400/60">¥{(o.amount / 10000).toFixed(0)}万 · {o.stage}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload & Event Chain Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: Upload */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">上传拜访记录</h2>
            <p className="text-sm text-white/45">上传后将自动触发事件链：创建 → 分析 → 经营建议</p>

            <label className="block text-sm text-white/60 cursor-pointer">
              <div className="rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-400/40 p-8 text-center transition">
                <input
                  type="file"
                  accept=".md,text/markdown"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleMarkdownUpload(file);
                  }}
                  disabled={uploadingMarkdown || !selectedCustomerId}
                />
                <p className="text-white/40 text-sm">
                  {uploadingMarkdown ? '上传并执行中...' : '点击或拖拽 Markdown 文件'}
                </p>
              </div>
            </label>

            {markdownPreview && (
              <div className="rounded-lg bg-black/20 border border-white/5 p-3">
                <p className="text-xs text-white/35 mb-2">预览</p>
                <pre className="text-xs text-white/60 whitespace-pre-wrap overflow-auto max-h-40">
                  {markdownPreview.substring(0, 800)}{markdownPreview.length > 800 ? '...' : ''}
                </pre>
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{uploadError}</div>
            )}

            {createResult && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                拜访记录已创建: {createResult.visit_record_id}
              </div>
            )}
          </div>

          {/* Right: Event Chain Status */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">本体事件链</h2>
            {eventChain.length === 0 ? (
              <p className="text-sm text-white/35">上传拜访记录后，事件链将自动传播</p>
            ) : (
              <>
              <div className="space-y-3">
                {eventChain.map((entry, idx) => (
                  <div key={idx} className={`rounded-xl border p-3 flex items-center gap-3 ${
                    entry.status === 'completed' ? 'border-emerald-400/20 bg-emerald-400/5' :
                    entry.status === 'error' ? 'border-red-400/20 bg-red-400/5' :
                    entry.status === 'running' ? 'border-amber-400/20 bg-amber-400/5' :
                    'border-white/10 bg-white/5'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      entry.status === 'completed' ? 'bg-emerald-400' :
                      entry.status === 'error' ? 'bg-red-400' :
                      entry.status === 'running' ? 'bg-amber-400 animate-pulse' :
                      'bg-white/30'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80">
                        {entry.eventCode === 'waiting' ? '等待事件派发...' :
                         entry.eventCode === 'advice_generated' ? '经营建议已生成' :
                         entry.eventCode}
                      </p>
                      {entry.subscriberSkill && (
                        <p className="text-xs text-white/40">{entry.subscriberSkill}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.status === 'completed' ? 'bg-emerald-400/20 text-emerald-300' :
                      entry.status === 'error' ? 'bg-red-400/20 text-red-300' :
                      entry.status === 'running' ? 'bg-amber-400/20 text-amber-300' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {entry.status === 'completed' ? '完成' :
                       entry.status === 'error' ? '失败' :
                       entry.status === 'running' ? '运行中' :
                       '已派发'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Visit Analysis Insights - Graph Query Results */}
              {(() => {
                const visitResult = eventChain.find(e => e.eventCode === 'visit_record.analyzed' && e.status === 'completed')?.result;
                if (!visitResult) return null;
                const r = visitResult as Record<string, any>;
                const stakeholders = r.keyStakeholders || [];
                const nextStep = r.nextStepSuggestion || '';
                const urgency = r.urgency || '';
                const oppSignals = r.opportunitySignals || [];
                return (
                  <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 space-y-2.5">
                    <p className="text-xs text-cyan-300/80">图谱查询洞察</p>
                    {stakeholders.length > 0 && (
                      <div>
                        <p className="text-xs text-white/35 mb-1">识别到的关键决策人（来自图谱+LLM）</p>
                        <div className="flex flex-wrap gap-1.5">
                          {stakeholders.map((s: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/20">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {nextStep && (
                      <div>
                        <p className="text-xs text-white/35 mb-1">下一步建议</p>
                        <p className="text-sm text-white/60">{nextStep}</p>
                      </div>
                    )}
                    {urgency && (() => {
                      const urgMap: Record<string, { color: string; label: string }> = {
                        high: { color: 'bg-red-400/20 text-red-300', label: '高' },
                        medium: { color: 'bg-amber-400/20 text-amber-300', label: '中' },
                        low: { color: 'bg-green-400/20 text-green-300', label: '低' },
                        高: { color: 'bg-red-400/20 text-red-300', label: '高' },
                        中: { color: 'bg-amber-400/20 text-amber-300', label: '中' },
                        低: { color: 'bg-green-400/20 text-green-300', label: '低' },
                      };
                      const style = urgMap[urgency] || urgMap.low;
                      return (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-white/35">紧急度:</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${style.color}`}>{style.label}</span>
                      </div>
                      );
                    })()}
                    {oppSignals.length > 0 && (
                      <div>
                        <p className="text-xs text-white/35 mb-1">机会信号</p>
                        <div className="space-y-1">
                          {oppSignals.map((s: string, i: number) => (
                            <p key={i} className="text-xs text-emerald-200/70">💡 {s}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              </>
            )}
          </div>
        </div>

        {/* Profile Analysis Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">人物画像分析</h2>
              <p className="text-sm text-white/45 mt-1">支持面试与 CRM 客户拜访两类场景，生成结构化 Markdown 画像</p>
            </div>
            <div className="flex gap-2">
              {(['crm_visit', 'interview'] as ProfileScenario[]).map((scenario) => (
                <button
                  key={scenario}
                  onClick={() => setProfileScenario(scenario)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    profileScenario === scenario
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {scenario === 'crm_visit' ? 'CRM 客户拜访' : '面试'}
                </button>
              ))}
            </div>
          </div>

          {profileScenario === 'crm_visit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35 mb-2">拜访记录</p>
                  <div className="space-y-2">
                    {(customerContext?.visit_records || []).map((record: any) => (
                      <button
                        key={record.id}
                        onClick={() => setSelectedVisitRecordId(record.id)}
                        className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                          selectedVisitRecordId === record.id
                            ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                            : 'border-white/10 bg-[#111214] text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium">第 {record.sequence_no} 轮 · {record.title}</div>
                        <div className="text-xs text-white/35 mt-1">{record.sentiment} / {record.status}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">转写 / 纪要内容</p>
                <textarea
                  value={selectedVisitRecordContent}
                  onChange={(e) => setSelectedVisitRecordContent(e.target.value)}
                  className="w-full min-h-[260px] rounded-xl border border-white/10 bg-[#111214] px-4 py-3 text-sm text-white/75 outline-none focus:border-cyan-400/40"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">面试转写内容</p>
              <textarea
                value={interviewTranscript}
                onChange={(e) => setInterviewTranscript(e.target.value)}
                placeholder="粘贴面试录音转写，建议包含发言人标签，例如：发言人1：... / 发言人2：..."
                className="w-full min-h-[260px] rounded-xl border border-white/10 bg-[#111214] px-4 py-3 text-sm text-white/75 outline-none focus:border-cyan-400/40"
              />
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-6">
            <div className="rounded-2xl border border-white/10 bg-[#111214] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">发言人映射</p>
                  <p className="text-xs text-white/35 mt-1">将“发言人1/发言人2”改成真实姓名，画像输出会直接使用映射后的名字</p>
                </div>
              </div>

              {detectedSpeakers.length === 0 ? (
                <p className="text-sm text-white/35">当前内容里还没有识别到发言人标签，可直接在转写中补充如“发言人1：”后再分析。</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {detectedSpeakers.map((speaker) => (
                      <button
                        key={speaker}
                        onClick={() => setActiveSpeaker(speaker)}
                        className={`px-3 py-2 rounded-full text-sm border transition ${
                          activeSpeaker === speaker
                            ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
                            : 'border-white/10 bg-white/5 text-white/65'
                        }`}
                      >
                        {speaker}
                        {(speakerAliases[speaker] || globalSpeakerAliases[speaker]) && (
                          <span className="ml-2 text-xs text-emerald-300">
                            → {speakerAliases[speaker] || globalSpeakerAliases[speaker]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      value={speakerAliasDraft}
                      onChange={(e) => setSpeakerAliasDraft(e.target.value)}
                      placeholder={activeSpeaker ? `给 ${activeSpeaker} 起一个真实名字` : '先选择一个发言人'}
                      className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/40"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={applySingleSpeakerAlias}
                        disabled={!activeSpeaker || !speakerAliasDraft.trim()}
                        className="px-4 py-3 rounded-xl bg-indigo-500 text-white text-sm disabled:opacity-40"
                      >
                        单个
                      </button>
                      <button
                        onClick={applyGlobalSpeakerAlias}
                        disabled={!activeSpeaker || !speakerAliasDraft.trim()}
                        className="px-4 py-3 rounded-xl bg-white/10 text-white text-sm disabled:opacity-40"
                      >
                        全局
                      </button>
                    </div>
                  </div>

                  {Object.keys(globalSpeakerAliases).length > 0 && (
                    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35 mb-2">常用发言人</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(globalSpeakerAliases).map(([raw, alias]) => (
                          <span key={raw} className="px-2.5 py-1 rounded-full bg-white/6 text-xs text-white/60 border border-white/8">
                            {raw} → {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111214] p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-white">大模型提示词</p>
                <p className="text-xs text-white/35 mt-1">已为面试 / CRM 客户拜访准备两套结构化画像 prompt，生成时会自动选用对应模板。</p>
              </div>
              <pre className="text-xs text-white/55 whitespace-pre-wrap overflow-auto max-h-[280px] rounded-xl border border-white/8 bg-black/20 p-3">
                {profileResult?.prompt || (profileScenario === 'crm_visit'
                  ? 'CRM 客户拜访画像 prompt 将结合当前客户上下文和转写内容自动生成。'
                  : '面试画像 prompt 将结合当前转写内容和发言人映射自动生成。')}
              </pre>
              <button
                onClick={handleAnalyzeProfile}
                disabled={profileGenerating || !profileTranscript.trim()}
                className="w-full rounded-xl bg-cyan-500 text-black font-medium px-4 py-3 text-sm disabled:opacity-40"
              >
                {profileGenerating ? '生成中...' : '生成结构化画像 Markdown'}
              </button>
              {profileError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{profileError}</div>
              )}
            </div>
          </div>

          {profileResult && (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">结构化画像输出</h3>
                  <p className="text-xs text-white/40 mt-1">可直接作为后续图片构建内容，例如“张三：XXX，李四：XXX”</p>
                </div>
                <a
                  href={profileResult.markdownUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/20 text-sm hover:bg-emerald-500/25"
                >
                  打开 md 文件
                </a>
              </div>

              <div className="rounded-xl border border-white/8 bg-black/20 p-5 prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-li:my-1">
                <ReactMarkdown>{profileResult.markdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Advice Drafts Section */}
        {adviceList.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">建议草稿</h2>
            {adviceList.map((advice, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#111214] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">第 {advice.round_no} 轮建议</p>
                  <div className="flex items-center gap-2">
                    {advice.render_status === 'generating' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        报告生成中
                      </span>
                    ) : advice.advice_html_url ? (
                      <a href={advice.advice_html_url} target="_blank" rel="noreferrer" className="text-sm text-cyan-300 hover:text-cyan-200 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20">打开报告</a>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-white/85">{advice.current_assessment}</p>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35 mb-2">建议动作</p>
                  <div className="space-y-2">
                    {advice.recommended_actions?.map(action => (
                      <div key={action} className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-100">{action}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35 mb-2">建议依据</p>
                  <pre className="text-xs text-white/50 whitespace-pre-wrap overflow-auto max-h-24">{advice.evidence_summary}</pre>
                </div>
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                  变化: {advice.change_since_last_round}
                </div>
                {advice.llm_advice && (() => {
                  const llm = advice.llm_advice as Record<string, any>;

                  // Helper: get value with Chinese or English key fallback
                  const gv = (cn: string, en: string) => llm[cn] ?? llm[en] ?? undefined;

                  // MEDDIC 评估 - Chinese keys preferred
                  const meddic = gv('MEDDIC评估', 'meddic_summary');

                  // Priority
                  const priority = gv('优先级', 'priority');
                  const priorityMap: Record<string, string> = { high: '高', medium: '中', low: '低', 高: '高', 中: '中', 低: '低' };
                  const priorityCn = priority ? (priorityMap[priority] || priority) : '';

                  return (
                  <div className="rounded-lg border border-purple-400/20 bg-purple-400/10 p-3 space-y-3">
                    <p className="text-xs text-purple-300 mb-1">🧠 LLM 图谱推理建议</p>

                    {/* MEDDIC 评估 */}
                    {meddic && (
                      <div className="rounded border border-purple-400/15 bg-purple-400/5 p-2">
                        <p className="text-xs text-purple-300/80 mb-1.5">MEDDIC 评估</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          {Object.entries(meddic as Record<string, string>).map(([k, v]) => {
                            // Translate old English keys to Chinese
                            const keyMap: Record<string, string> = {
                              metrics: '量化指标',
                              economic_buyer: '经济决策人',
                              champion: '内部支持者',
                              decision_criteria: '决策标准',
                              decision_process: '决策流程',
                              identified_pain: '已识别痛点',
                            };
                            const label = keyMap[k] || k;
                            return (
                              <div key={k} className="flex gap-1.5">
                                <span className="text-white/30 shrink-0 w-[60px]">{label}</span>
                                <span className="text-white/60">{v}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 联系人策略 */}
                    {gv('联系人策略', 'contact_strategy') && (
                      <div>
                        <p className="text-xs text-purple-300/80 mb-1">联系人策略</p>
                        <p className="text-sm text-white/60">{gv('联系人策略', 'contact_strategy')}</p>
                      </div>
                    )}

                    {/* 风险缓解 */}
                    {gv('风险缓解', 'risk_mitigation') && (
                      <div>
                        <p className="text-xs text-purple-300/80 mb-1">风险缓解</p>
                        <p className="text-sm text-white/60">{gv('风险缓解', 'risk_mitigation')}</p>
                      </div>
                    )}

                    {/* 竞品应对 */}
                    {gv('竞品应对', 'competitor_response') && (
                      <div>
                        <p className="text-xs text-purple-300/80 mb-1">竞品应对</p>
                        <p className="text-sm text-white/60">{gv('竞品应对', 'competitor_response')}</p>
                      </div>
                    )}

                    {/* 目标与优先级 */}
                    {(gv('建议目标', 'advice_target') || priority || gv('预期结果', 'expected_results')) && (
                      <div className="flex gap-3 text-xs flex-wrap">
                        {gv('建议目标', 'advice_target') && (
                          <span className="text-white/40">目标: <span className="text-white/60">{gv('建议目标', 'advice_target')}</span></span>
                        )}
                        {priorityCn && (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            priorityCn === '高' ? 'bg-red-400/20 text-red-300' :
                            priorityCn === '中' ? 'bg-amber-400/20 text-amber-300' :
                            'bg-green-400/20 text-green-300'
                          }`}>优先级: {priorityCn}</span>
                        )}
                      </div>
                    )}
                    {gv('预期结果', 'expected_results') && (
                      <p className="text-xs text-white/40">预期结果: <span className="text-white/60">{gv('预期结果', 'expected_results')}</span></p>
                    )}
                  </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Clear Data Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1B] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">确认清空全部数据</h3>
            <p className="text-sm text-white/60 mb-4">
              将清空 <span className="text-white font-medium">{currentOntology?.ontology_code || currentOntologyId}</span> 在 MongoDB、Neo4j、ChromaDB 中的数据。
            </p>
            <p className="text-sm text-red-400 mb-6">此操作不可恢复，确定继续吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 text-sm">取消</button>
              <button onClick={handleClearData} disabled={clearing} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm disabled:opacity-50">
                {clearing ? '清空中...' : '确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Runtime Data Confirmation */}
      {showClearRuntimeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1B] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">确认清空运行数据</h3>
            <p className="text-sm text-white/60 mb-2">
              将清空 <span className="text-white font-medium">{currentOntology?.ontology_code || currentOntologyId}</span> 的：
            </p>
            <ul className="text-sm text-white/40 mb-4 list-disc list-inside space-y-1">
              <li>拜访记录</li>
              <li>经营建议</li>
              <li>事件链日志</li>
            </ul>
            <p className="text-sm text-orange-400 mb-6">此操作不可恢复，确定继续吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowClearRuntimeConfirm(false)} className="px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 text-sm">取消</button>
              <button onClick={handleClearRuntimeData} disabled={clearingRuntime} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm disabled:opacity-50">
                {clearingRuntime ? '清空中...' : '确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}

      {clearResult && (
        <div className="fixed bottom-4 right-4 bg-[#1A1A1B] border border-white/10 rounded-xl p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">全部数据已清空</p>
              <div className="text-xs text-white/50 mt-1 space-y-0.5">
                <p>MongoDB: {clearResult.cleared.mongodb.documents_deleted} 条文档</p>
                <p>Neo4j: {clearResult.cleared.neo4j.nodes_deleted} 个节点, {clearResult.cleared.neo4j.relationships_deleted} 条关系</p>
                <p>ChromaDB: {clearResult.cleared.chroma.documents_deleted} 条向量</p>
                {clearResult.cleared.sqlite && (
                  <p>SQLite: {clearResult.cleared.sqlite.advice_artifacts} 条建议, {clearResult.cleared.sqlite.event_bus_logs} 条日志</p>
                )}
              </div>
            </div>
            <button onClick={() => setClearResult(null)} className="text-white/40 hover:text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {clearRuntimeResult && (
        <div className="fixed bottom-4 right-4 bg-[#1A1A1B] border border-white/10 rounded-xl p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">运行数据已清空</p>
              <div className="text-xs text-white/50 mt-1 space-y-0.5">
                <p>拜访记录: {clearRuntimeResult.cleared.visit_records} 条</p>
                <p>经营建议: {clearRuntimeResult.cleared.advice_artifacts} 条</p>
                <p>事件链日志: {clearRuntimeResult.cleared.event_bus_logs} 条</p>
              </div>
            </div>
            <button onClick={() => setClearRuntimeResult(null)} className="text-white/40 hover:text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
