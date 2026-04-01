import { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertCircle, Bell } from 'lucide-react';
import type { EventDraft, BlockReference } from '../../types/ontology';
import { api } from '../../api';
import { useOntologyStore } from '../../store/ontology-store';
import DeleteBlockDialog from '../shared/DeleteBlockDialog';

interface Props {
  ontologyId: number;
}

const EMPTY_FORM: Omit<EventDraft, 'id' | 'ontology_id' | 'created_at' | 'updated_at'> = {
  code: '',
  name: '',
  description: '',
  producer_object: '',
  producer_behavior: '',
  subscribers: [],
  impacted_objects: [],
};

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

export default function EventsWorkspace({ ontologyId }: Props) {
  const { events, objects, behaviors, loadEvents } = useOntologyStore();

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDraft | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<{ name: string; refs: BlockReference[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors([]);
    setError(null);
    setShowForm(true);
  }

  function openEdit(ev: EventDraft) {
    setEditingEvent(ev);
    setForm({
      code: ev.code,
      name: ev.name,
      description: ev.description,
      producer_object: ev.producer_object,
      producer_behavior: ev.producer_behavior,
      subscribers: [...ev.subscribers],
      impacted_objects: [...ev.impacted_objects],
    });
    setFormErrors([]);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEvent(null);
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
      if (editingEvent) {
        await api.events.update(ontologyId, editingEvent.code, form);
      } else {
        await api.events.create(ontologyId, form);
      }
      await loadEvents(ontologyId);
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

  async function handleDelete(ev: EventDraft) {
    setError(null);
    try {
      await api.events.delete(ontologyId, ev.code);
      await loadEvents(ontologyId);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.blocked === true && Array.isArray(e.references)) {
        setDeleteBlock({ name: ev.name, refs: e.references as BlockReference[] });
      } else {
        setError('删除失败，请重试');
      }
    }
  }

  // ── Derived option lists ────────────────────────────────────────────────

  const objectOptions = objects.map((o) => ({ value: o.code, label: `${o.name} - ${o.code}` }));
  const behaviorOptions = behaviors.map((b) => ({
    value: b.code,
    label: `${b.name} - ${b.code}`,
  }));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-white/50" />
            <h2 className="text-base font-semibold text-white">事件</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/8 text-xs text-white/50">
            {events.length}
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
            新建事件
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
            <Bell size={32} className="text-white/15" />
            <p className="text-sm">暂无事件，点击「新建事件」开始添加</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">名称</th>
                <th className="text-left px-4 py-3 font-medium">产生对象</th>
                <th className="text-left px-4 py-3 font-medium">产生行为</th>
                <th className="text-left px-4 py-3 font-medium">订阅行为</th>
                <th className="text-left px-4 py-3 font-medium">影响对象</th>
                <th className="text-right px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const producerObj = objects.find((o) => o.code === ev.producer_object);
                const producerBhv = behaviors.find((b) => b.code === ev.producer_behavior);
                return (
                  <tr
                    key={ev.id}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-white/60 text-xs">{ev.code}</td>
                    <td className="px-4 py-3 text-white font-medium">{ev.name}</td>
                    <td className="px-4 py-3 text-white/60">
                      {producerObj ? (
                        producerObj.name
                      ) : ev.producer_object ? (
                        <span className="text-white/30 italic">{ev.producer_object}</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {producerBhv ? (
                        producerBhv.name
                      ) : ev.producer_behavior ? (
                        <span className="text-white/30 italic">{ev.producer_behavior}</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev.subscribers.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-xs">
                          {ev.subscribers.length} 个
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev.impacted_objects.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs">
                          {ev.impacted_objects.length} 个
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(ev)}
                          className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-white transition-colors"
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(ev)}
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
                {editingEvent ? '编辑事件' : '新建事件'}
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
                    disabled={!!editingEvent}
                    required={!editingEvent}
                    placeholder="e.g. lead_created"
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
                    placeholder="事件名称"
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
                    placeholder="事件描述（可选）"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20 resize-none"
                  />
                </div>

                {/* Producer Object */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    产生对象 (producer_object)
                  </label>
                  <select
                    value={form.producer_object}
                    onChange={(e) => updateField('producer_object', e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="">— 不指定 —</option>
                    {objects.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name} - {o.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Producer Behavior */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    产生行为 (producer_behavior)
                  </label>
                  <select
                    value={form.producer_behavior}
                    onChange={(e) => updateField('producer_behavior', e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="">— 不指定 —</option>
                    {behaviors.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} - {b.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subscribers — behavior codes */}
                <MultiSelectCheckboxes
                  label="订阅行为 (subscribers)"
                  options={behaviorOptions}
                  selected={form.subscribers}
                  onChange={(sel) => updateField('subscribers', sel)}
                />

                {/* Impacted Objects */}
                <MultiSelectCheckboxes
                  label="影响对象 (impacted_objects)"
                  options={objectOptions}
                  selected={form.impacted_objects}
                  onChange={(sel) => updateField('impacted_objects', sel)}
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
                  {submitting ? '保存中…' : editingEvent ? '保存更改' : '创建事件'}
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
