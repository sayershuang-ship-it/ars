const BASE = '';

export interface EpisodeEntry { series: string; epId: string; filePath: string }
export interface PrepareArtifact { youtube: { candidates: Candidate[]; selected: string | null }; status: string }
export interface Candidate { id: string; title: string; description: string; tags: string[]; rationale: string }

export async function getEpisodes(): Promise<EpisodeEntry[]> {
  const res = await fetch(`${BASE}/api/episodes`);
  if (!res.ok) throw new Error('Failed to fetch episodes');
  return res.json();
}

export async function getPlan(epId: string): Promise<{ content: string }> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/plan`);
  if (!res.ok) throw new Error('Failed to fetch plan');
  return res.json();
}

export async function savePlan(epId: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to save plan');
}

export async function getPrepare(epId: string): Promise<PrepareArtifact> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/prepare`);
  if (!res.ok) throw new Error('Failed to fetch prepare artifact');
  return res.json();
}

export async function selectCandidate(epId: string, candidateId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/prepare/select`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId }),
  });
  if (!res.ok) throw new Error('Failed to select candidate');
}

export async function getOauthStatus(): Promise<{ connected: boolean }> {
  const res = await fetch(`${BASE}/oauth/youtube/status`);
  return res.json();
}

export async function getStudioPort(epId: string): Promise<{ port: number }> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/studio-port`);
  if (!res.ok) throw new Error('Studio failed to start');
  return res.json();
}

export function openSse(
  url: string,
  onEvent: (data: Record<string, unknown>) => void,
  body?: Record<string, unknown>,
): () => void {
  const controller = new AbortController();
  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try { onEvent(JSON.parse(line.slice(6))); } catch { /* ignore */ }
        }
      }
    }
  }).catch(() => {/* aborted */});
  return () => controller.abort();
}
