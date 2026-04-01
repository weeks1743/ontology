import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { YamlBundle, ValidationResult, ValidationIssue } from '../../types/ontology';
import { api } from '../../api';

interface Props {
  ontologyId: number;
}

type FileKey = 'model' | 'objects' | 'behaviors' | 'rules' | 'events' | 'scenarios';

const FILE_TABS: { key: FileKey; label: string }[] = [
  { key: 'model',     label: 'model.yaml'     },
  { key: 'objects',   label: 'objects.yaml'   },
  { key: 'behaviors', label: 'behaviors.yaml' },
  { key: 'rules',     label: 'rules.yaml'     },
  { key: 'events',    label: 'events.yaml'    },
  { key: 'scenarios', label: 'scenarios.yaml' },
];

// ── Syntax-highlighted YAML line renderer ────────────────────────────────────

function renderYamlLine(line: string, index: number): React.ReactNode {
  // Comment lines
  if (/^\s*#/.test(line)) {
    return (
      <span key={index} className="block text-white/30 italic">
        {line}
      </span>
    );
  }

  // List marker lines (e.g. "  - value" or "  - ")
  const listMatch = line.match(/^(\s*)(- )(.*)$/);
  if (listMatch) {
    const [, indent, marker, rest] = listMatch;
    return (
      <span key={index} className="block">
        <span>{indent}</span>
        <span className="text-white/40">{marker}</span>
        <span className="text-white/80">{rest}</span>
      </span>
    );
  }

  // Key: value lines
  const kvMatch = line.match(/^(\s*)([^:]+)(:)(\s*)(.*)$/);
  if (kvMatch) {
    const [, indent, key, colon, space, value] = kvMatch;

    let valueNode: React.ReactNode;
    if (value === '') {
      // mapping header, no value
      valueNode = null;
    } else if (/^["'].*["']$/.test(value.trim()) || (/^[^0-9\-\[{]/.test(value.trim()) && !/^(true|false|null|~)$/.test(value.trim()))) {
      // string-looking value
      valueNode = <span className="text-emerald-300/90">{value}</span>;
    } else if (/^-?\d+(\.\d+)?$/.test(value.trim()) || /^(true|false|null|~)$/.test(value.trim())) {
      // number / bool / null
      valueNode = <span className="text-purple-300/90">{value}</span>;
    } else {
      valueNode = <span className="text-white/80">{value}</span>;
    }

    return (
      <span key={index} className="block">
        <span className="text-white/40">{indent}</span>
        <span className="text-cyan-400/90">{key}</span>
        <span className="text-white/40">{colon}</span>
        <span>{space}</span>
        {valueNode}
      </span>
    );
  }

  // Document separator or empty
  if (/^---/.test(line)) {
    return (
      <span key={index} className="block text-white/25">
        {line}
      </span>
    );
  }

  return (
    <span key={index} className="block text-white/80">
      {line}
    </span>
  );
}

// ── Validation Banner ─────────────────────────────────────────────────────────

function ValidationBanner({ validation }: { validation: ValidationResult }) {
  const [expanded, setExpanded] = useState(false);

  const hasErrors   = validation.errors   > 0;
  const hasWarnings = validation.warnings > 0;
  const allClear    = !hasErrors && !hasWarnings;

  let bannerCls: string;
  let bannerIcon: React.ReactNode;
  let bannerText: string;

  if (hasErrors) {
    bannerCls  = 'bg-red-500/10 border border-red-500/25 text-red-300';
    bannerIcon = <AlertCircle size={15} className="shrink-0 mt-0.5" />;
    bannerText = `当前草稿不完整 — ${validation.errors} 个错误，${validation.warnings} 个警告`;
  } else if (hasWarnings) {
    bannerCls  = 'bg-yellow-500/10 border border-yellow-500/25 text-yellow-300';
    bannerIcon = <AlertTriangle size={15} className="shrink-0 mt-0.5" />;
    bannerText = `${validation.warnings} 个警告`;
  } else {
    bannerCls  = 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300';
    bannerIcon = <Info size={15} className="shrink-0 mt-0.5" />;
    bannerText = '草稿完整 ✓';
  }

  return (
    <div className={`rounded-xl overflow-hidden ${bannerCls}`}>
      <button
        onClick={() => !allClear && setExpanded(v => !v)}
        className={`w-full flex items-start gap-2 px-4 py-3 text-sm font-medium text-left ${!allClear ? 'cursor-pointer hover:brightness-110' : 'cursor-default'} transition-all`}
      >
        {bannerIcon}
        <span className="flex-1">{bannerText}</span>
        {!allClear && (
          <span className="text-xs opacity-60 mt-0.5 select-none">
            {expanded ? '收起' : '展开详情'}
          </span>
        )}
      </button>

      {expanded && validation.issues.length > 0 && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {validation.issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const isError = issue.level === 'error';
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className={`mt-0.5 shrink-0 ${isError ? 'text-red-400' : 'text-yellow-400'}`}>
        {isError
          ? <AlertCircle size={13} />
          : <AlertTriangle size={13} />
        }
      </span>
      <span className="text-xs font-mono text-white/40 shrink-0 w-20 truncate mt-0.5">
        {issue.entity_type}
      </span>
      <span className="text-xs font-mono text-indigo-300/70 shrink-0 w-28 truncate mt-0.5">
        {issue.entity_code}
      </span>
      <span className="text-xs text-white/70 leading-relaxed">
        {issue.message}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function YamlWorkspace({ ontologyId }: Props) {
  const [bundle,     setBundle]     = useState<YamlBundle | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeFile, setActiveFile] = useState<FileKey>('model');
  const [copied,     setCopied]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, v] = await Promise.all([
        api.yaml(ontologyId),
        api.validation(ontologyId),
      ]);
      setBundle(b);
      setValidation(v);
    } catch (err) {
      console.error('Failed to load YAML workspace:', err);
    } finally {
      setLoading(false);
    }
  }, [ontologyId]);

  useEffect(() => { load(); }, [load]);

  const currentContent = bundle ? bundle[activeFile] : '';

  const handleCopy = async () => {
    if (!currentContent) return;
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const lines = currentContent ? currentContent.split('\n') : [];

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">

      {/* Validation Banner */}
      {!loading && validation && (
        <ValidationBanner validation={validation} />
      )}

      {/* Loading skeleton for banner */}
      {loading && (
        <div className="h-11 rounded-xl bg-white/5 animate-pulse" />
      )}

      {/* File tabs + Refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-0.5 bg-white/4 rounded-lg p-1 overflow-x-auto scrollbar-none">
          {FILE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFile(tab.key)}
              className={`
                px-3 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap transition-all
                ${activeFile === tab.key
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          title="刷新"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/6 border border-white/8 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>刷新</span>
        </button>
      </div>

      {/* YAML Content Area */}
      <div className="relative flex-1 min-h-0 flex flex-col bg-[#0D0D10] border border-white/8 rounded-xl overflow-hidden">

        {/* Content area header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6 bg-white/[0.02] shrink-0">
          <span className="text-xs font-mono text-white/30">
            {activeFile}.yaml
            {!loading && lines.length > 0 && (
              <span className="ml-3 text-white/20">{lines.length} lines</span>
            )}
          </span>
          <button
            onClick={handleCopy}
            disabled={!currentContent || loading}
            title="复制内容"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white/40 hover:text-white/70 hover:bg-white/6 border border-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copied
              ? <><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">已复制</span></>
              : <><Copy size={12} /><span>复制</span></>
            }
          </button>
        </div>

        {/* Scrollable pre block */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3.5 rounded bg-white/5 animate-pulse"
                  style={{ width: `${30 + Math.random() * 55}%`, animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
          ) : !currentContent ? (
            <div className="flex items-center justify-center h-48 text-white/25 text-sm">
              无内容
            </div>
          ) : (
            <pre className="p-5 text-[13px] leading-[1.65] font-mono min-w-0 overflow-x-auto select-text">
              {lines.map((line, i) => renderYamlLine(line, i))}
            </pre>
          )}
        </div>
      </div>

      {/* Footer: generated_at */}
      {!loading && bundle?.generated_at && (
        <div className="flex justify-end">
          <span className="text-[11px] text-white/20 font-mono">
            生成于 {new Date(bundle.generated_at).toLocaleString('zh-CN', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
}
