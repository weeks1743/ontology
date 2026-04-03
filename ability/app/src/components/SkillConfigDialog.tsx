import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SkillConfigDialogProps {
  skillId: string;
  skillName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string>) => void;
}

export default function SkillConfigDialog({
  skillId,
  skillName,
  isOpen,
  onClose,
  onSave,
}: SkillConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && skillId) {
      fetchConfig();
    }
  }, [isOpen, skillId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/external-skills/config/${skillId}`);
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/external-skills/config/${skillId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        onSave(config);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setConfig({ ...config, [key]: value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-effect rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">配置技能</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-4">{skillName}</p>

          {skillId === 'ext.baidu_search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  BAIDU_API_KEY
                </label>
                <input
                  type="password"
                  value={config.BAIDU_API_KEY || ''}
                  onChange={(e) => handleChange('BAIDU_API_KEY', e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-glass-border rounded focus:outline-none focus:border-blue-500"
                  placeholder="输入百度搜索 API Key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  从百度智能云获取 API Key
                </p>
              </div>
            </div>
          )}

          {skillId === 'ext.volcengine_web_search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ARK_API_KEY
                </label>
                <input
                  type="password"
                  value={config.ARK_API_KEY || ''}
                  onChange={(e) => handleChange('ARK_API_KEY', e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-glass-border rounded focus:outline-none focus:border-blue-500"
                  placeholder="输入火山方舟 API Key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  从火山方舟控制台获取 API Key（方舟控制台 → API Key 管理）
                </p>
              </div>
            </div>
          )}

          {skillId === 'ext.kai_report_creator' && (
            <div className="text-sm text-gray-400">
              此技能无需配置
            </div>
          )}

          {!['ext.baidu_search', 'ext.volcengine_web_search', 'ext.kai_report_creator'].includes(skillId) && (
            <div className="text-sm text-gray-400">
              此技能无需配置
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
