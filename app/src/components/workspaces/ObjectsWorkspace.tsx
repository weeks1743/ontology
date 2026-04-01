import { useState } from 'react';
import { Plus, Pencil, Trash2, X, ChevronDown, AlertCircle } from 'lucide-react';
import type { ObjectDraft, ObjectAttribute, ObjectRelation, BlockReference } from '../../types/ontology';
import { api } from '../../api';
import { useOntologyStore } from '../../store/ontology-store';
import DeleteBlockDialog from '../shared/DeleteBlockDialog';

interface Props {
  ontologyId: number;
}

const ATTRIBUTE_TYPES: ObjectAttribute['type'][] = [
  'string', 'number', 'boolean', 'date', 'enum', 'reference', 'array',
];

const RELATION_TYPES: ObjectRelation['type'][] = [
  'one-to-one', 'one-to-many', 'many-to-many',
];

const inputCls =
  'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder:text-white/20 disabled:opacity-40 disabled:cursor-not-allowed';

const selectCls =
  'bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 appearance-none transition-colors';

// ── Object Form Modal ────────────────────────────────────────────────────────

interface FormProps {
  ontologyId: number;
  editing: ObjectDraft | null;
  allObjects: ObjectDraft[];
  onClose: () => void;
  onSaved: () => void;
}

function ObjectForm({ ontologyId, editing, allObjects, onClose, onSaved }: FormProps) {
  const isEdit = editing !== null;

  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [lifecycle, setLifecycle] = useState((editing?.lifecycle ?? []).join(', '));
  const [attributes, setAttributes] = useState<ObjectAttribute[]>(
    editing?.attributes ?? [],
  );
  const [relations, setRelations] = useState<ObjectRelation[]>(
    editing?.relations_detail ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Attribute helpers ──────────────────────────────────────────────────────

  const addAttribute = () => {
    setAttributes((prev) => [
      ...prev,
      { name: '', type: 'string', required: false },
    ]);
  };

  const updateAttribute = (index: number, patch: Partial<ObjectAttribute>) => {
    setAttributes((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );
  };

  const removeAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Relation helpers ───────────────────────────────────────────────────────

  const addRelation = () => {
    setRelations((prev) => [
      ...prev,
      { name: '', target_object: '', type: 'one-to-one' },
    ]);
  };

  const updateRelation = (index: number, patch: Partial<ObjectRelation>) => {
    setRelations((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const removeRelation = (index: number) => {
    setRelations((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('名称不能为空');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: Partial<ObjectDraft> = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        lifecycle: lifecycle
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        attributes,
        relations_detail: relations,
      };
      if (isEdit) {
        await api.objects.update(ontologyId, editing!.code, payload);
      } else {
        await api.objects.create(ontologyId, payload);
      }
      onSaved();
    } catch (err: unknown) {
      const e = err as { message?: string; detail?: string };
      setError(e?.detail ?? e?.message ?? '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const otherObjects = allObjects.filter((o) => o.code !== editing?.code);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-10 px-4">
      <div className="w-full max-w-2xl bg-[#111113] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 sticky top-0 bg-[#111113] rounded-t-2xl z-10">
          <h3 className="text-base font-semibold text-white">
            {isEdit ? '编辑对象' : '新建对象'}
          </h3>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">代码（英文标识）</label>
              <input
                className={`${inputCls} w-full`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isEdit}
                placeholder="e.g. customer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">
                名称 <span className="text-red-400">*</span>
              </label>
              <input
                className={`${inputCls} w-full`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="对象名称"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-white/40">描述</label>
            <textarea
              className={`${inputCls} w-full resize-none`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选描述"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-white/40">
              生命周期阶段（逗号分隔）
            </label>
            <input
              className={`${inputCls} w-full`}
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value)}
              placeholder="e.g. lead, active, churned"
            />
          </div>

          {/* Attributes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white/80">属性</h4>
              <button
                type="button"
                onClick={addAttribute}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus size={13} /> 添加属性
              </button>
            </div>
            {attributes.length === 0 ? (
              <p className="text-xs text-white/25 py-2">暂无属性</p>
            ) : (
              <div className="space-y-2">
                {attributes.map((attr, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_140px_auto_auto] gap-2 items-center"
                  >
                    <input
                      className={`${inputCls} w-full`}
                      value={attr.name}
                      onChange={(e) =>
                        updateAttribute(i, { name: e.target.value })
                      }
                      placeholder="属性名"
                    />
                    <div className="relative">
                      <select
                        className={`${selectCls} w-full pr-7`}
                        value={attr.type}
                        onChange={(e) =>
                          updateAttribute(i, {
                            type: e.target.value as ObjectAttribute['type'],
                          })
                        }
                      >
                        {ATTRIBUTE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={13}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer select-none whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={attr.required ?? false}
                        onChange={(e) =>
                          updateAttribute(i, { required: e.target.checked })
                        }
                        className="accent-indigo-500"
                      />
                      必填
                    </label>
                    <button
                      type="button"
                      onClick={() => removeAttribute(i)}
                      className="text-white/25 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Relations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white/80">关系</h4>
              <button
                type="button"
                onClick={addRelation}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus size={13} /> 添加关系
              </button>
            </div>
            {relations.length === 0 ? (
              <p className="text-xs text-white/25 py-2">暂无关系</p>
            ) : (
              <div className="space-y-2">
                {relations.map((rel, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_140px_160px_auto] gap-2 items-center"
                  >
                    <input
                      className={`${inputCls} w-full`}
                      value={rel.name}
                      onChange={(e) =>
                        updateRelation(i, { name: e.target.value })
                      }
                      placeholder="关系名"
                    />
                    <div className="relative">
                      <select
                        className={`${selectCls} w-full pr-7`}
                        value={rel.type}
                        onChange={(e) =>
                          updateRelation(i, {
                            type: e.target.value as ObjectRelation['type'],
                          })
                        }
                      >
                        {RELATION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={13}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                      />
                    </div>
                    <div className="relative">
                      <select
                        className={`${selectCls} w-full pr-7`}
                        value={rel.target_object}
                        onChange={(e) =>
                          updateRelation(i, { target_object: e.target.value })
                        }
                      >
                        <option value="">目标对象…</option>
                        {otherObjects.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.name} ({o.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={13}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRelation(i)}
                      className="text-white/25 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 sticky bottom-0 bg-[#111113] rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '保存中…' : isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Workspace ───────────────────────────────────────────────────────────

export default function ObjectsWorkspace({ ontologyId }: Props) {
  const { objects, loadObjects } = useOntologyStore();

  const [showForm, setShowForm] = useState(false);
  const [editingObject, setEditingObject] = useState<ObjectDraft | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<{
    name: string;
    refs: BlockReference[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNew = () => {
    setEditingObject(null);
    setShowForm(true);
  };

  const handleEdit = (obj: ObjectDraft) => {
    setEditingObject(obj);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingObject(null);
  };

  const handleSaved = async () => {
    await loadObjects(ontologyId);
    setShowForm(false);
    setEditingObject(null);
  };

  const handleDelete = async (obj: ObjectDraft) => {
    setError(null);
    try {
      await api.objects.delete(ontologyId, obj.code);
      await loadObjects(ontologyId);
    } catch (err: unknown) {
      const e = err as { blocked?: boolean; references?: BlockReference[]; message?: string; detail?: string };
      if (e?.blocked && e?.references) {
        setDeleteBlock({ name: obj.name, refs: e.references });
      } else {
        setError(e?.detail ?? e?.message ?? '删除失败，请重试');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0B] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white">对象</h2>
          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/50 font-mono">
            {objects.length}
          </span>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          新建对象
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm text-red-400">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/50 hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/25">
            <p className="text-sm">暂无对象，点击"新建对象"开始创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/35 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-medium">代码</th>
                  <th className="px-5 py-3.5 font-medium">名称</th>
                  <th className="px-5 py-3.5 font-medium">描述</th>
                  <th className="px-5 py-3.5 font-medium text-center">属性数</th>
                  <th className="px-5 py-3.5 font-medium text-center">关系数</th>
                  <th className="px-5 py-3.5 font-medium text-center">
                    生命周期阶段数
                  </th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj) => (
                  <tr
                    key={obj.code}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                        {obj.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-white">
                      {obj.name}
                    </td>
                    <td className="px-5 py-3.5 text-white/45 max-w-xs truncate">
                      {obj.description || (
                        <span className="text-white/20 italic">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-white/60 font-mono text-xs">
                        {obj.attributes?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-white/60 font-mono text-xs">
                        {obj.relations_detail?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-white/60 font-mono text-xs">
                        {obj.lifecycle?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(obj)}
                          className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/8 transition-colors"
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(obj)}
                          className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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

      {/* Create / Edit modal */}
      {showForm && (
        <ObjectForm
          ontologyId={ontologyId}
          editing={editingObject}
          allObjects={objects}
          onClose={handleFormClose}
          onSaved={handleSaved}
        />
      )}

      {/* Delete blocked dialog */}
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
