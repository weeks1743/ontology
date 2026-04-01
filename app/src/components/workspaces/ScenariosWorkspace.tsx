import { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertCircle, Film, GripVertical } from 'lucide-react';
import type { ScenarioDraft, ScenarioStep, BlockReference } from '../../types/ontology';
import { api } from '../../api';
import { useOntologyStore } from '../../store/ontology-store';
import DeleteBlockDialog from '../shared/DeleteBlockDialog';

interface Props {
  ontologyId: number;
}

// ── Step type ───────────────────────────────────────���─────────────────────────

type StepType = 'behavior' | 'event' | 'decision';

interface StepDraft {
  type: StepType;
  behavior: string;
  event: string;
  decisionInput: string; // raw comma-separated input
}

function stepDraftToScenarioStep(draft: StepDraft, index: number): ScenarioStep {
  const step: ScenarioStep = { step: index + 1 };
  if (draft.type === 'behavior') {
    step.behavior = draft.behavior;
  } else if (draft.type === 'event') {
    step.event = draft.event;
  } else {
    step.decision_gate = draft.decisionInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return step;
}

function scenarioStepToStepDraft(s: ScenarioStep): StepDraft {
  if (s.behavior !== undefined) {
    return { type: 'behavior', behavior: s.behavior, event: '', decisionInput: '' };
  } else if (s.event !== undefined) {
    return { type: 'event', behavior: '', event: s.event, decisionInput: '' };
  } else {
    return {
      type: 'decision',
      behavior: '',
      event: '',
      decisionInput: (s.decision_gate ?? []).join(', '),
    };
  }
}

const EMPTY_STEP: StepDraft = { type: 'behavior', behavior: '', event: '', decisionInput: '' };

// ── Form shape ────────────────────────────────────────────────────────────────

interface FormState {
  code: string;
  name: string;
  description: string;
  business_goal: string;
  involved_objects: string[];
  success_criteria: string[];
  steps: StepDraft[];
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  business_goal: '',
  involved_objects: [],
  success_criteria: [],
  steps: [],
};

// ── Tag Input ─────────────────────────────────────────────────────────────────

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

// ── Multi-select Checkboxes ───────────────────────────────────────────────────

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
        <p className="text-xs text-white/30 italic">暂无可选对象</p>
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

// ── Step Editor ───────────────────────────────────────────────────────────────

interface StepEditorProps {
  index: number;
  step: StepDraft;
  behaviorOptions: { value: string; label: string }[];
  eventOptions: { value: string; label: string }[];
  onChange: (index: number, updated: StepDraft) => void;
  onRemove: (index: number) => void;
}

function StepEditor({ index, step, behaviorOptions, eventOptions, onChange, onRemove }: StepEditorProps) {
  const TYPE_TABS: { key: StepType; label: string }[] = [
    { key: 'behavior', label: '行为步骤' },
    { key: 'event', label: '事件步骤' },
    { key: 'decision', label: '决策门' },
  ];

  function update(patch: Partial<StepDraft>) {
    onChange(index, { ...step, ...patch });
  }

  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
      {/* Step header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-white/20" />
          <span className="text-xs font-mono text-white/40 bg-white/8 rounded px-2 py-0.5">
            步骤 {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 rounded hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors"
          title="删除步骤"
        >
          <X size={14} />
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => update({ type: tab.key })}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              step.type === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conditional content */}
      {step.type === 'behavior' && (
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">行为</label>
          <select
            value={step.behavior}
            onChange={(e) => update({ behavior: e.target.value })}
            className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
          >
            <option value="">— 选择行为 —</option>
            {behaviorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {step.type === 'event' && (
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">事件</label>
          <select
            value={step.event}
            onChange={(e) => update({ event: e.target.value })}
            className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
          >
            <option value="">— 选择事件 —</option>
            {eventOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {step.type === 'decision' && (
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">
            决策分支 <span className="text-white/30">(逗号分隔)</span>
          </label>
          <input
            type="text"
            value={step.decisionInput}
            onChange={(e) => update({ decisionInput: e.target.value })}
            placeholder="e.g. 审批通过, 审批拒绝, 需补充材料"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20"
          />
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScenariosWorkspace({ ontologyId }: Props) {
  const { scenarios, objects, behaviors, events, loadScenarios } = useOntologyStore();

  const [showForm, setShowForm] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioDraft | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<{ name: string; refs: BlockReference[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setEditingScenario(null);
    setForm({ ...EMPTY_FORM, steps: [] });
    setFormErrors([]);
    setError(null);
    setShowForm(true);
  }

  function openEdit(s: ScenarioDraft) {
    setEditingScenario(s);
    setForm({
      code: s.code,
      name: s.name,
      description: s.description,
      business_goal: s.business_goal,
      involved_objects: [...s.involved_objects],
      success_criteria: [...s.success_criteria],
      steps: s.steps.map(scenarioStepToStepDraft),
    });
    setFormErrors([]);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingScenario(null);
    setFormErrors([]);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Step helpers ───────────────────────────────────────────────────────────

  function addStep() {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, { ...EMPTY_STEP }] }));
  }

  function updateStep(index: number, updated: StepDraft) {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = updated;
      return { ...prev, steps };
    });
  }

  function removeStep(index: number) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors([]);
    setSubmitting(true);

    const payload: Omit<ScenarioDraft, 'id' | 'ontology_id' | 'created_at' | 'updated_at'> = {
      code: form.code,
      name: form.name,
      description: form.description,
      business_goal: form.business_goal,
      involved_objects: form.involved_objects,
      success_criteria: form.success_criteria,
      steps: form.steps.map(stepDraftToScenarioStep),
    };

    try {
      if (editingScenario) {
        await api.scenarios.update(ontologyId, editingScenario.code, payload);
      } else {
        await api.scenarios.create(ontologyId, payload);
      }
      await loadScenarios(ontologyId);
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

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(s: ScenarioDraft) {
    if (!window.confirm(`确认删除场景「${s.name}」？此操作不可撤销。`)) return;
    setError(null);
    try {
      await api.scenarios.delete(ontologyId, s.code);
      await loadScenarios(ontologyId);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.blocked === true && Array.isArray(e.references)) {
        setDeleteBlock({ name: s.name, refs: e.references as BlockReference[] });
      } else {
        setError('删除失败，请重试');
      }
    }
  }

  // ── Derived option lists ───────────────────────────────────────────────────

  const objectOptions = objects.map((o) => ({ value: o.code, label: `${o.name} (${o.code})` }));

  // 根据涉及对象过滤行为和事件
  const involvedObjects = form.involved_objects;

  // 只显示归属于涉及对象的行为
  const behaviorOptions = behaviors
    .filter((b) => involvedObjects.length === 0 || involvedObjects.includes(b.owner_object))
    .map((b) => ({ value: b.code, label: `${b.name} - ${b.code}` }));

  // 只显示由涉及对象产生的事件
  const eventOptions = events
    .filter((ev) => involvedObjects.length === 0 || involvedObjects.includes(ev.producer_object))
    .map((ev) => ({ value: ev.code, label: `${ev.name} - ${ev.code}` }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-indigo-400" />
            <h2 className="text-base font-semibold text-white">场景</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/8 text-xs text-white/50">
            {scenarios.length}
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
            新建场景
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
            <Film size={36} className="text-white/10" />
            <p className="text-sm">暂无场景，点击「新建场景」开始添加</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">名称</th>
                <th className="text-left px-4 py-3 font-medium">业务目标</th>
                <th className="text-left px-4 py-3 font-medium">涉及对象</th>
                <th className="text-left px-4 py-3 font-medium">步骤数</th>
                <th className="text-right px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors"
                >
                  <td className="px-6 py-3 font-mono text-white/60 text-xs">{s.code}</td>
                  <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-white/60 max-w-xs">
                    {s.business_goal ? (
                      <span className="line-clamp-2">{s.business_goal}</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.involved_objects.length > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-xs">
                        {s.involved_objects.length} 个
                      </span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.steps.length > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-white/8 text-white/70 text-xs">
                        {s.steps.length} 步
                      </span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-white transition-colors"
                        title="编辑"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"
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
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 bg-white/5 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
              <h3 className="font-semibold text-white">
                {editingScenario ? '编辑场景' : '新建场景'}
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
                    {formErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-400">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{err}</span>
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
                    disabled={!!editingScenario}
                    required={!editingScenario}
                    placeholder="e.g. lead_qualification"
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
                    placeholder="场景名称"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">描述</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={2}
                    placeholder="场景描述（可选）"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20 resize-none"
                  />
                </div>

                {/* Business Goal */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    业务目标
                  </label>
                  <textarea
                    value={form.business_goal}
                    onChange={(e) => updateField('business_goal', e.target.value)}
                    rows={2}
                    placeholder="描述此场景的业务目标"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20 resize-none"
                  />
                </div>

                {/* Involved Objects */}
                <MultiSelectCheckboxes
                  label="涉及对象 (involved_objects)"
                  options={objectOptions}
                  selected={form.involved_objects}
                  onChange={(sel) => updateField('involved_objects', sel)}
                />

                {/* Success Criteria */}
                <TagInput
                  label="成功标准 (success_criteria)"
                  tags={form.success_criteria}
                  onChange={(tags) => updateField('success_criteria', tags)}
                />

                {/* Steps */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">
                    步骤列表
                    <span className="ml-1.5 text-white/30">({form.steps.length} 个步骤)</span>
                  </label>

                  {form.steps.length === 0 ? (
                    <p className="text-xs text-white/25 italic mb-2">暂无步骤，点击下方按钮添加</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {form.steps.map((step, index) => (
                        <StepEditor
                          key={index}
                          index={index}
                          step={step}
                          behaviorOptions={behaviorOptions}
                          eventOptions={eventOptions}
                          onChange={updateStep}
                          onRemove={removeStep}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1.5 px-3 py-2 w-full justify-center border border-dashed border-white/15 rounded-lg text-sm text-white/40 hover:text-white/70 hover:border-white/30 transition-colors"
                  >
                    <Plus size={14} />
                    添加步骤
                  </button>
                </div>
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
                  {submitting ? '保存中…' : editingScenario ? '保存更改' : '创建场景'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Block Dialog (for reference conflicts, if any) */}
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
