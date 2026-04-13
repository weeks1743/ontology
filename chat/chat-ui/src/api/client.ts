export const chatApi = {
  getOntologies: async () => {
    const res = await fetch('/api/ontologies');
    if (!res.ok) throw new Error('Failed to fetch ontologies');
    return res.json();
  },

  getThreads: async (ontologyId: string) => {
    const res = await fetch(`/api/chat/threads?ontology_id=${encodeURIComponent(ontologyId)}`);
    if (!res.ok) throw new Error('Failed to fetch threads');
    return res.json();
  },

  getThread: async (threadId: string) => {
    const res = await fetch(`/api/chat/threads/${threadId}`);
    if (!res.ok) throw new Error('Failed to fetch thread');
    return res.json();
  },

  createThread: async (ontologyId: string, assistantId: string, title?: string) => {
    const res = await fetch('/api/chat/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ontologyId, assistantId, title }),
    });
    if (!res.ok) throw new Error('Failed to create thread');
    return res.json();
  },

  submitMessage: async (threadId: string, text: string, files: File[]) => {
    const formData = new FormData();
    formData.append('text', text);
    files.forEach((file) => formData.append('files', file));

    const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to submit message');
    return res.json();
  },

  updateMessage: async (threadId: string, messageId: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/chat/threads/${threadId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update message');
    return res.json();
  },

  getJob: async (jobId: string) => {
    const res = await fetch(`/api/chat/jobs/${jobId}`);
    if (!res.ok) throw new Error('Failed to fetch job');
    return res.json();
  },
};
