import { useEffect, useState } from 'react';
import { useAbilityStore } from '../store/ability-store';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function ExecutionLogsPage() {
  const { logs, fetchLogs } = useAbilityStore();
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'partial'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.status === filter);

  return (
    <div className="h-full overflow-auto bg-[#0A0A0B]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">执行历史</h1>
          <p className="text-sm text-white/40 mt-1">查看所有技能执行记录和状态</p>
        </div>

        {/* 过滤器 */}
        <div className="flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-indigo-600/20 text-white' : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            全部 ({logs.length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            成功 ({logs.filter(l => l.status === 'success').length})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            失败 ({logs.filter(l => l.status === 'error').length})
          </button>
        </div>

        {/* 日志列表 */}
        <div className="space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center text-white/40">
              暂无执行记录
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {/* 日志行 */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex-shrink-0">
                    {log.status === 'success' ? (
                      <CheckCircle className="text-green-400" size={18} />
                    ) : log.status === 'error' ? (
                      <XCircle className="text-red-400" size={18} />
                    ) : (
                      <AlertCircle className="text-yellow-400" size={18} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white">{log.skill_name}</span>
                  </div>
                  <span className="text-xs text-white/40 flex-shrink-0">
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </span>
                  <span className="text-xs font-mono text-white/40 flex-shrink-0">{log.duration_ms}ms</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(log.mongodb_status)}`}>M</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(log.neo4j_status)}`}>N</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(log.chroma_status)}`}>C</span>
                  </div>
                  {expandedLog === log.id
                    ? <ChevronUp size={14} className="text-white/40 flex-shrink-0" />
                    : <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
                  }
                </div>

                {/* 展开区：执行结果 */}
                {expandedLog === log.id && (
                  <div className="border-t border-white/10 px-5 py-4 space-y-3">
                    {log.output_result && (
                      <OutputResultViewer raw={log.output_result} />
                    )}
                    {!log.output_result && (
                      <p className="text-xs text-white/30">无输出数据</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function OutputResultViewer({ raw }: { raw: any }) {
  const [showHtml, setShowHtml] = useState(false);

  let parsed: any = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  }

  // Extract output text
  const outputText: string = (() => {
    if (typeof parsed === 'string') return parsed;
    if (parsed?.output) return typeof parsed.output === 'string' ? parsed.output : JSON.stringify(parsed.output, null, 2);
    if (parsed?.message) return parsed.message;
    return JSON.stringify(parsed, null, 2);
  })();

  // Detect HTML content
  const htmlContent = extractHtmlContent(outputText);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 uppercase tracking-wide">执行结果</span>
        {htmlContent && (
          <button
            onClick={() => setShowHtml(!showHtml)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {showHtml ? '查看文本' : '预览 HTML'}
          </button>
        )}
      </div>

      {showHtml && htmlContent ? (
        <iframe
          srcDoc={htmlContent}
          className="w-full rounded-lg border border-white/10"
          style={{ height: '480px' }}
          sandbox="allow-scripts allow-same-origin"
          title="执行结果预览"
        />
      ) : (
        <pre className="text-xs text-white/70 bg-black/30 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap break-words">
          {outputText}
        </pre>
      )}
    </div>
  );
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

function getStatusColor(status: 'ok' | 'error' | 'skipped') {
  switch (status) {
    case 'ok':
      return 'bg-green-500/20 text-green-400';
    case 'error':
      return 'bg-red-500/20 text-red-400';
    case 'skipped':
      return 'bg-gray-500/20 text-gray-400';
  }
}
