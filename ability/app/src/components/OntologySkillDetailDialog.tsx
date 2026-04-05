import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface OntologySkillDetailDialogProps {
  skill: {
    id: string;
    name: string;
    display_name?: string;
    skill_type?: 'behavior' | 'scenario' | 'query';
    metadata: {
      emoji?: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function OntologySkillDetailDialog({
  skill,
  isOpen,
  onClose,
}: OntologySkillDetailDialogProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && skill.id) {
      fetchDetail();
    }
  }, [isOpen, skill.id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}/detail`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || '');
      } else {
        setContent('无法加载技能详情');
      }
    } catch (error) {
      console.error('Failed to fetch skill detail:', error);
      setContent('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const displayName = skill.display_name || skill.name;
  const emoji = skill.metadata.emoji || '⚙️';

  // 类型 badge 颜色
  const typeBadgeColor = (() => {
    switch (skill.skill_type) {
      case 'behavior':
        return 'bg-blue-500/20 text-blue-400';
      case 'scenario':
        return 'bg-purple-500/20 text-purple-400';
      default:
        return 'bg-white/10 text-white/60';
    }
  })();

  const typeBadgeLabel = (() => {
    switch (skill.skill_type) {
      case 'behavior':
        return '行为技能';
      case 'scenario':
        return '场景技能';
      case 'query':
        return '查询技能';
      default:
        return '本体技能';
    }
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-3xl max-h-[80vh] bg-[#111113] border border-white/10 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{emoji}</span>
            <div>
              <h2 className="text-xl font-semibold text-white">{displayName}</h2>
              <span className={`text-xs px-2 py-0.5 rounded ${typeBadgeColor}`}>
                {typeBadgeLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/40">加载中...</div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-white mb-3 mt-6">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-semibold text-white mb-2 mt-4">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-white/80 mb-3 leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-white/80 mb-3 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-white/80 mb-3 space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-white/80">{children}</li>
                  ),
                  code: ({ className, children }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-white/10 rounded text-sm text-indigo-300 font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className="block p-4 bg-white/5 rounded-lg text-sm text-white/90 font-mono overflow-x-auto">
                        {children}
                      </code>
                    );
                  },
                  strong: ({ children }) => (
                    <strong className="font-semibold text-white">{children}</strong>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}