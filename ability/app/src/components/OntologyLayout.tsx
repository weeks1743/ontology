import { useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { useAbilityStore } from '../store/ability-store';
import LeftSidebar from './LeftSidebar';

export default function OntologyLayout() {
  const { ontologyId } = useParams<{ ontologyId: string }>();
  const { setCurrentOntologyId } = useAbilityStore();

  useEffect(() => {
    if (ontologyId) {
      setCurrentOntologyId(ontologyId);
    }
  }, [ontologyId, setCurrentOntologyId]);

  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)] overflow-hidden">
      <LeftSidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}