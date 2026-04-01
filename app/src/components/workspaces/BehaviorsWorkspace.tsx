import { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertCircle } from 'lucide-react';
import type { BehaviorDraft, TriggerType, BlockReference } from '../../types/ontology';
import { api } from '../../api';
import { useOntologyStore } from '../../store/ontology-store';
import DeleteBlockDialog from '../shared/DeleteBlockDialog';

interface Props {
  ontologyId: number;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  USER_ACTION: '用户操作',
  AI_OR_USER_ACTION: 'AI/用户',
  SYSTEM_ACTION: '系统操作',
  SYSTEM_OR_MANAGER_ACTION: '系统/管理员',
};

const TRIGGER_OPTIONS: TriggerType[] = [
  'USER_ACTION',
  'AI_OR_USER_ACTION',
  'SYSTEM_ACTION',
  'SYSTEM_OR_MANAGER_ACTION',
];

const EMPTY_FORM: Omit<BehaviorDraft, 'id' | 'ontology_id' | 'created_at' | 'updated_at'> = {
  code: '',
  name: '',
  description: '',
  owner_object: '',
  trigger_type: 'USER_ACTION',
  required_inputs: [],
  referenced_rules: [],
  emits_events: [],
  writeback_targets: [],
};

// ── Tag Input ────────────────────────────────────────────────────────────────

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagInput({ label, tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  function commit() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const newTags = trimmed
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && !tags.includes(t));
    if (newTags.length > 0) onChange([...tags, ...newTags]);
    setInputValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <div className="min-h-[42px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 items-center">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-white/10 rounded px-2 py-0.5 text-xs text-white"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={tags.length === 0 ? '输入后按 Enter 或逗号添加' : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white outline-none placeholder:text-white/20"
        />
      </div>
    </div>
  );
}

// ── Multi-select Checkboxes ──────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelectCheckboxes({ label, options, selected, onChange }: MultiSelectProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {options.length === 0 ? (
        <p className="text-xs text-white/30 italic">暂无可选项</p>
      ) : (
        <div className="max-h-36 overflow-y-auto space-y-1 border border-white/10 rounded-lg p-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-indigo-500"
              />
              <span className="text-sm text-white/80">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BehaviorsWorkspace({ ontologyId }: Props) {
  const { behaviors, objects, rules, events, loadBehaviors, loadRules, loadEvents } =
    useOntologyStore();

  const [showForm, setShowForm] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState<BehaviorDraft | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<{ name: string; refs: BlockReference[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setEditingBehavior(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors([]);
    setError(null);
    setShowForm(true);
  }

  function openEdit(b: BehaviorDraft) {
    setEditingBehavior(b);
    setForm({
      code: b.code,
      name: b.name,
      description: b.description,
      owner_object: b.owner_object,
      trigger_type: b.trigger_type,
      required_inputs: [...b.required_inputs],
      referenced_rules: [...b.referenced_rules],
      emits_events: [...b.emits_events],
      writeback_targets: [...b.writeback_targets],
    });
    setFormErrors([]);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingBehavior(null);
    setFormErrors([]);
  }

  function updateField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors([]);
    setSubmitting(true);
    try {
      if (editingBehavior) {
        await api.behaviors.update(ontologyId, editingBehavior.code, form);
      } else {
        await api.behaviors.create(ontologyId, form);
      }
      await Promise.all([
        loadBehaviors(ontologyId),
        loadRules(ontologyId),
        loadEvents(ontologyId),
      ]);
      closeForm();
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (Array.isArray(e.errors)) {
        setFormErrors(e.errors as string[]);
      } else if (typeof e.detail === 'string') {
        setFormErrors([e.detail]);
      } else {
        setFormErrors(['保存失败，请重试']);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  async function handleDelete(b: BehaviorDraft) {
    setError(null);
    try {
      await api.behaviors.delete(ontologyId, b.code);
      await loadBehaviors(ontologyId);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.blocked === true && Array.isArray(e.references)) {
        setDeleteBlock({ name: b.name, refs: e.references as BlockReference[] });
      } else {
        setError('删除失败，请重试');
      }
    }
  }

  // ── Derived option lists ────────────────────────────────────────────────

  // 根据选择的归属对象过滤规则和事件
  const selectedOwnerObject = form.owner_object;

  // 只显示适用于当前归属对象的规则
  const ruleOptions = rules
    .filter((r) => !selectedOwnerObject || r.applicable_objects.includes(selectedOwnerObject))
    .map((r) => ({ value: r.code, label: `${r.name} - ${r.code}` }));

  // 只显示由当前归属对象产生的事件
  const eventOptions = events
    .filter((ev) => !selectedOwnerObject || ev.producer_object === selectedOwnerObject)
    .map((ev) => ({ value: ev.code, label: `${ev.name} - ${ev.code}` }));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white">行为</h2>
          <span className="px-2 py-0.5 rounded-full bg-white/8 text-xs text-white/50">
            {behaviors.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-red-400 text-sm">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus size={14} />
            新建行为
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {behaviors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
            <p className="text-sm">暂无行为，点击「新建行为」开始添加</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">名称</th>
                <th className="text-left px-4 py-3 font-medium">归属对象</th>
                <th className="text-left px-4 py-3 font-medium">触发类型</th>
                <th className="text-left px-4 py-3 font-medium">触发事件</th>
                <th className="text-right px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {behaviors.map((b) => {
                const ownerObj = objects.find((o) => o.code === b.owner_object);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-white/60 text-xs">{b.code}</td>
                    <td className="px-4 py-3 text-white font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-white/60">
                      {ownerObj ? ownerObj.name : b.owner_object ? (
                        <span className="text-white/30 italic">{b.owner_object}</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-white/8 text-white/70 text-xs">
                        {TRIGGER_LABELS[b.trigger_type] ?? b.trigger_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50">
                      {b.emits_events.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-xs">
                          {b.emits_events.length} 个
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(b)}
                          className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-white transition-colors"
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-1.5 rounded hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 bg-white/5 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
              <h3 className="font-semibold text-white">
                {editingBehavior ? '编辑行为' : '新建行为'}
              </h3>
              <button
                onClick={closeForm}
                className="text-white/30 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Validation errors */}
                {formErrors.length > 0 && (
                  <div className="flex flex-col gap-1 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {formErrors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-400">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Code */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => updateField('code', e.target.value)}
                    disabled={!!editingBehavior}
                    required={!editingBehavior}
                    placeholder="e.g. create_lead"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                    placeholder="行为名称"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">描述</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                    placeholder="行为描述（可选）"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20 resize-none"
                  />
                </div>

                {/* Owner Object */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    归属对象
                  </label>
                  <select
                    value={form.owner_object}
                    onChange={(e) => updateField('owner_object', e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="">— 不指定 —</option>
                    {objects.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trigger Type */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    触发类型
                  </label>
                  <select
                    value={form.trigger_type}
                    onChange={(e) => updateField('trigger_type', e.target.value as TriggerType)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    {TRIGGER_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {TRIGGER_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Required Inputs */}
                <TagInput
                  label="必要输入 (required_inputs)"
                  tags={form.required_inputs}
                  onChange={(tags) => updateField('required_inputs', tags)}
                />

                {/* Referenced Rules */}
                <MultiSelectCheckboxes
                  label="引用规则 (referenced_rules)"
                  options={ruleOptions}
                  selected={form.referenced_rules}
                  onChange={(sel) => updateField('referenced_rules', sel)}
                />

                {/* Emits Events */}
                <MultiSelectCheckboxes
                  label="触发事件 (emits_events)"
                  options={eventOptions}
                  selected={form.emits_events}
                  onChange={(sel) => updateField('emits_events', sel)}
                />

                {/* Writeback Targets */}
                <TagInput
                  label="回写目标 (writeback_targets)"
                  tags={form.writeback_targets}
                  onChange={(tags) => updateField('writeback_targets', tags)}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '保存中…' : editingBehavior ? '保存更改' : '创建行为'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
