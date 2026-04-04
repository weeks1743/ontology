import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOntologyStore } from '../store/ontology-store';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function CreateOntologyPage() {
  const navigate = useNavigate();
  const { createOntology } = useOntologyStore();
  const [form, setForm] = useState({ ontology_code: '', display_name: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ontology_code || !form.display_name) return;
    setSaving(true);
    setError(null);
    try {
      const o = await createOntology(form);
      navigate(`/ontologies/${o.id}`);
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e.error ?? '创建失败');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <div className="w-px h-4 bg-white/10" />
        <h1 className="text-lg font-semibold">新建 CRM 本体</h1>
      </div>

      {/* Form */}
      <div className="flex justify-center py-16 px-8">
        <div className="w-full max-w-lg">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <p className="text-white/50 text-sm mb-8">
              创建一个新的 CRM 本体草稿。本体代码一旦创建不可修改。
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  本体代码 <span className="text-red-400">*</span>
                  <span className="text-white/30 font-normal ml-2 text-xs">创建后不可修改</span>
                </label>
                <input
                  type="text"
                  value={form.ontology_code}
                  onChange={(e) => setForm({ ...form, ontology_code: e.target.value })}
                  placeholder="e.g. crm_v1"
                  pattern="[a-zA-Z][a-zA-Z0-9_\-]*"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8"
                />
                <p className="text-xs text-white/30 mt-1.5">以字母开头，只允许字母、数字、下划线、短横线</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  显示名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="e.g. CRM 客户关系管理本体 v1"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  描述 <span className="text-white/30 font-normal text-xs">可选</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="简要说明本体的用途和范围..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving || !form.ontology_code || !form.display_name}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? '创建中...' : '创建 CRM 本体'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
