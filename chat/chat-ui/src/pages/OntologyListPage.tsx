import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type OntologyOption } from '../store/chat-store';
import { Database } from 'lucide-react';

const ONTOLOGY_COLORS: Record<string, string> = {
  CRM: '#6366F1',
  default: '#6366F1',
};

function OntologyCard({ ontology }: { ontology: OntologyOption }) {
  const navigate = useNavigate();
  const color = ONTOLOGY_COLORS[ontology.ontology_code] || ONTOLOGY_COLORS.default;

  return (
    <div
      onClick={() => navigate(`/chat/${ontology.id}`)}
      className="ontology-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigate(`/chat/${ontology.id}`);
        }
      }}
    >
      <div className="ontology-card-header">
        <div className="ontology-card-icon" style={{ backgroundColor: `${color}20` }}>
          <Database size={20} style={{ color }} />
        </div>
        <div>
          <h3 className="ontology-card-title">{ontology.display_name}</h3>
          <p className="ontology-card-code">{ontology.ontology_code}</p>
        </div>
      </div>

      {ontology.description && (
        <p className="ontology-card-desc">{ontology.description}</p>
      )}
    </div>
  );
}

export default function OntologyListPage() {
  const { ontologies, loading, error, fetchOntologies } = useChatStore();

  useEffect(() => {
    fetchOntologies();
  }, [fetchOntologies]);

  if (loading) {
    return (
      <div className="ontology-selector-page">
        <div className="ontology-selector-loading">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ontology-selector-page">
        <div className="ontology-selector-error">错误: {error}</div>
      </div>
    );
  }

  return (
    <div className="ontology-selector-page">
      <div className="ontology-selector-header">
        <div>
          <h1 className="ontology-selector-title">选择应用系统</h1>
          <p className="ontology-selector-subtitle">选择一个本体以开始对话</p>
        </div>
      </div>

      <div className="ontology-selector-content">
        <div className="ontology-grid">
          {ontologies.map((ontology) => (
            <OntologyCard key={ontology.id} ontology={ontology} />
          ))}
        </div>

        {ontologies.length === 0 && (
          <div className="ontology-empty">
            <Database size={64} className="ontology-empty-icon" />
            <p className="ontology-empty-text">暂无本体系统</p>
            <p className="ontology-empty-hint">请先在主系统创建本体</p>
          </div>
        )}
      </div>
    </div>
  );
}
