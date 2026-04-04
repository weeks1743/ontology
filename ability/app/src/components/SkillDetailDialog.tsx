import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SkillDetailDialogProps {
  skillId: string;
  skillName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SkillDetailDialog({
  skillId,
  skillName,
  isOpen,
  onClose,
}: SkillDetailDialogProps) {
  const [content, setContent] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [githubBaseUrl, setGithubBaseUrl] = useState<string>('');
  const [githubPath, setGithubPath] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && skillId) {
      fetchDetail();
    }
  }, [isOpen, skillId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skillId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setSource(data.source);
        setGithubBaseUrl(data.github_base_url || '');
        setGithubPath(data.github_path || '');
      } else {
        setContent('无法加载技能详情');
        setSource('');
        setGithubBaseUrl('');
        setGithubPath('');
      }
    } catch (error) {
      console.error('Failed to fetch skill detail:', error);
      setContent('加载失败，请稍后重试');
      setSource('');
      setGithubBaseUrl('');
      setGithubPath('');
    } finally {
      setLoading(false);
    }
  };

  // 转换相对链接为 GitHub 绝对链接
  const transformLinkUri = (href: string): string => {
    // 绝对链接保持不变
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    // 相对链接转换为 GitHub 链接
    if (githubBaseUrl && githubPath) {
      // 构建完整 GitHub URL
      const base = `${githubBaseUrl}/${githubPath}`;
      // 处理相对路径（去除 ./ 等）
      const cleanHref = href.replace(/^\.\//, '');
      return `${base}/${cleanHref}`;
    }

    // 无法转换的相对链接返回空
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-3xl max-h-[80vh] bg-[#111113] border border-white/10 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">{skillName}</h2>
            {source && (
              <p className="text-sm text-white/40 mt-1">来源: {source}</p>
            )}
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
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-500 pl-4 my-4 text-white/70 italic">
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => {
                    if (!href) {
                      return <span className="text-white/60">{children}</span>;
                    }

                    const absoluteUrl = transformLinkUri(href);

                    // 无法转换的链接显示为普通文本
                    if (!absoluteUrl) {
                      return <span className="text-white/60 italic">{children}</span>;
                    }

                    return (
                      <a
                        href={absoluteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 underline"
                      >
                        {children}
                      </a>
                    );
                  },
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