import { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertCircle, Shield } from 'lucide-react';
import type { RuleDraft, SeverityLevel, BlockReference } from '../../types/ontology';
import { api } from '../../api';
import { useOntologyStore } from '../../store/ontology-store';
import DeleteBlockDialog from '../shared/DeleteBlockDialog';

interface Props {
  ontologyId: number;
}

// ── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const SEVERITY_CLASSES: Record<SeverityLevel, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const SEVERITY_DOT_CLASSES: Record<SeverityLevel, string> = {
  low: 'bg-emerald-400',
  medium: 'bg-yellow-400',
  high: 'bg-orange-400',
  critical: 'bg-red-400',
};

const RULE_TYPES = ['validation', 'constraint', 'calculation', 'escalation'] as const;

// ── Default form values ───────────────────────────────────────────────────────

function emptyDraft(): Omit<RuleDraft, 'id' | 'ontology_id' | 'created_at' | 'updated_at'> {
  return {
    code: '',
    name: '',
    description: '',
    type: 'validation',
    severity: 'medium',
    applicable_objects: [],
    applicable_behaviors: [],
    expression: '',
    failure_message: '',
    escalation_target: '',
  };
}

// ── Sub-components ───────────────────────────────────────���────────────────────

function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_CLASSES[severity]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT_CLASSES[severity]}`} />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs text-white/40 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    />
  );
}

function MultiSelectCheckboxes({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { code: string; name: string }[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const toggle = (code: string) => {
    onChange(
      selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]
    );
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {items.length === 0 ? (
        <p className="text-xs text-white/20 italic py-2">暂无可选项</p>
      ) : (
        <div className="max-h-36 overflow-y-auto bg-white/5 border border-white/10 rounded-lg divide-y divide-white/5">
          {items.map((item) => {
            const checked = selected.includes(item.code);
            return (
              <label
                key={item.code}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.code)}
                  className="w-3.5 h-3.5 rounded accent-indigo-500 flex-shrink-0"
                />
                <span className="text-sm text-white/80 truncate">{item.name}</span>
                <span className="text-xs font-mono text-white/30 ml-auto flex-shrink-0">{item.code}</span>
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-xs text-white/30 mt-1">已选 {selected.length} 项</p>
      )}
    </div>
  );
}

// ── Form Modal ────────────────────────────────────────────────────────────────

interface FormModalProps {
  editing: RuleDraft | null;
  ontologyId: number;
  objects: { code: string; name: string }[];
  behaviors: { code: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({ editing, ontologyId, objects, behaviors, onClose, onSaved }: FormModalProps) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<ReturnType<typeof emptyDraft>>(() =>
    isEdit
      ? {
          code: editing.code,
          name: editing.name,
          description: editing.description,
          type: editing.type,
          severity: editing.severity,
          applicable_objects: editing.applicable_objects ?? [],
          applicable_behaviors: editing.applicable_behaviors ?? [],
          expression: editing.expression,
          failure_message: editing.failure_message,
          escalation_target: editing.escalation_target,
        }
      : emptyDraft()
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('规则名称为必填项');
      return;
    }
    if (!isEdit && !form.code.trim()) {
      setError('规则编码为必填项');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.rules.update(ontologyId, editing.code, form);
      } else {
        await api.rules.create(ontologyId, form);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'detail' in err
          ? String((err as { detail: unknown }).detail)
          : '操作失败，请重试';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-2xl mx-4 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Shield size={16} className="text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-white">
              {isEdit ? '编辑规则' : '新建规则'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Row: code + name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required={!isEdit}>规则编码</FieldLabel>
              <TextInput
                value={form.code}
                onChange={(v) => set('code', v)}
                disabled={isEdit}
                placeholder="e.g. RULE_CREDIT_CHECK"
              />
            </div>
            <div>
              <FieldLabel required>规则名称</FieldLabel>
              <TextInput
                value={form.name}
                onChange={(v) => set('name', v)}
                placeholder="e.g. 信用评分检查"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>描述</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="规则用途说明..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-colors"
            />
          </div>

          {/* Row: type + severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>类型</FieldLabel>
              <div className="relative">
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-[#111113] text-white">
                      {t}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">▾</span>
              </div>
            </div>
            <div>
              <FieldLabel>严重程度</FieldLabel>
              <div className="relative">
                <select
                  value={form.severity}
                  onChange={(e) => set('severity', e.target.value as SeverityLevel)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
                >
                  {(['low', 'medium', 'high', 'critical'] as SeverityLevel[]).map((s) => (
                    <option key={s} value={s} className="bg-[#111113] text-white">
                      {SEVERITY_LABELS[s]} ({s})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">▾</span>
              </div>
            </div>
          </div>

          {/* applicable_objects */}
          <MultiSelectCheckboxes
            label="适用对象"
            items={objects}
            selected={form.applicable_objects}
            onChange={(codes) => set('applicable_objects', codes)}
          />

          {/* applicable_behaviors - 只显示归属于已选对象的行为 */}
          <MultiSelectCheckboxes
            label="适用行为"
            items={
              form.applicable_objects.length > 0
                ? behaviors.filter((b: any) => form.applicable_objects.includes(b.owner_object))
                : behaviors
            }
            selected={form.applicable_behaviors}
            onChange={(codes) => set('applicable_behaviors', codes)}
          />

          {/* expression */}
          <div>
            <FieldLabel>规则表达式</FieldLabel>
            <textarea
              value={form.expression}
              onChange={(e) => set('expression', e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="e.g. credit_score >= 600 AND account_status == 'active'"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 font-mono placeholder:text-white/20 placeholder:font-sans focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-y transition-colors"
            />
          </div>

          {/* failure_message */}
          <div>
            <FieldLabel>失败消息</FieldLabel>
            <TextInput
              value={form.failure_message}
              onChange={(v) => set('failure_message', v)}
              placeholder="规则不满足时的提示信息"
            />
          </div>

          {/* escalation_target */}
          <div>
            <FieldLabel>升级目标（可选）</FieldLabel>
            <TextInput
              value={form.escalation_target}
              onChange={(v) => set('escalation_target', v)}
              placeholder="e.g. MANAGER_APPROVAL"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? '保存中…' : isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RulesWorkspace({ ontologyId }: Props) {
  const { rules, objects, behaviors, loadRules } = useOntologyStore();

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleDraft | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<{ name: string; refs: BlockReference[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNew = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEdit = (rule: RuleDraft) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  const handleSaved = () => {
    loadRules(ontologyId);
  };

  const handleDelete = async (rule: RuleDraft) => {
    setError(null);
    try {
      await api.rules.delete(ontologyId, rule.code);
      await loadRules(ontologyId);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'blocked' in err &&
        (err as { blocked: unknown }).blocked === true
      ) {
        const blockErr = err as { blocked: true; references: BlockReference[] };
        setDeleteBlock({ name: rule.name, refs: blockErr.references });
      } else {
        const msg =
          err && typeof err === 'object' && 'detail' in err
            ? String((err as { detail: unknown }).detail)
            : '删除失败，请重试';
        setError(msg);
      }
    }
  };

  const objectOptions = objects.map((o) => ({ code: o.code, name: o.name }));
  const behaviorOptions = behaviors.map((b) => ({ code: b.code, name: b.name }));

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Shield size={16} className="text-indigo-400" />
          </div>
          <h2 className="text-base font-semibold text-white">规则</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-xs text-white/50">
            {rules.length}
          </span>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          新建规则
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-24 gap-3 text-white/20">
            <Shield size={36} strokeWidth={1} />
            <p className="text-sm">暂无规则，点击「新建规则」开始</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-white/40 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium text-left w-40">编码</th>
                  <th className="px-5 py-3 font-medium text-left">名称</th>
                  <th className="px-5 py-3 font-medium text-left w-32">类型</th>
                  <th className="px-5 py-3 font-medium text-left w-28">严重程度</th>
                  <th className="px-5 py-3 font-medium text-center w-24">适用对象</th>
                  <th className="px-5 py-3 font-medium text-right w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="group hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-white/50">{rule.code}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <span className="text-white/90 font-medium">{rule.name}</span>
                        {rule.description && (
                          <p className="text-xs text-white/30 mt-0.5 truncate max-w-xs">
                            {rule.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/6 border border-white/8 text-xs text-white/50">
                        {rule.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <SeverityBadge severity={rule.severity} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/6 border border-white/8 text-xs text-white/50">
                        {rule.applicable_objects?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-1.5 rounded-md hover:bg-white/8 text-white/30 hover:text-white transition-colors"
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <FormModal
          editing={editingRule}
          ontologyId={ontologyId}
          objects={objectOptions}
          behaviors={behaviorOptions}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Block Dialog */}
      {deleteBlock && (
        <DeleteBlockDialog
          entityName={deleteBlock.name}
          references={deleteBlock.refs}
          onClose={() => setDeleteBlock(null)}
        />
      )}
    </div>
  );
}
