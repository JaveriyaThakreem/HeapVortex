const API_BASE = '/api';

export async function fetchHeap() {
  const response = await fetch(`${API_BASE}/heap`);
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json();
}
