const API_BASE = '/api';

export async function fetchHeap() {
  const res = await fetch(`${API_BASE}/heap`);
  if (!res.ok) throw new Error(`API request failed (${res.status})`);
  return res.json();
}

export async function fetchLive() {
  const res = await fetch(`${API_BASE}/live`);
  if (!res.ok) throw new Error(`Live metrics failed (${res.status})`);
  return res.json();
}
