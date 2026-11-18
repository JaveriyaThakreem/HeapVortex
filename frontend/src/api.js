/**
 * @file api.js
 * Thin fetch wrappers for the HeapVortex Spring Boot REST API.
 * Base URL is relative so it works with the Vite proxy in dev
 * and against the same origin in production.
 */

const API_BASE = '/api';

/** Default fetch options applied to every request. */
const DEFAULT_OPTS = {
  headers: { 'Accept': 'application/json' },
};

/**
 * Fetch the full 10,000-node heap snapshot.
 * This is a heavy response (~2 MB) — call once on mount, not on every poll.
 * @returns {Promise<import('./types').HeapSnapshot>}
 */
export async function fetchHeap() {
  const res = await fetch(`${API_BASE}/heap`, DEFAULT_OPTS);
  if (!res.ok) throw new Error(`Heap snapshot failed (${res.status} ${res.statusText})`);
  return res.json();
}

/**
 * Fetch live JVM metrics (heap usage, GC count, threads, uptime, top objects).
 * Poll this every 3 seconds for the live dashboard.
 * @returns {Promise<import('./types').LiveMetrics>}
 */
export async function fetchLive() {
  const res = await fetch(`${API_BASE}/live`, DEFAULT_OPTS);
  if (!res.ok) throw new Error(`Live metrics failed (${res.status} ${res.statusText})`);
  return res.json();
}

/**
 * Fetch backend health status.
 * @returns {Promise<{status: string, service: string, version: string, timestamp: number}>}
 */
export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`, DEFAULT_OPTS);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

/**
 * Fetch aggregate stats about the simulated dataset.
 * @returns {Promise<{totalNodes: number, maxHeapBytes: number, gcCycleMs: number}>}
 */
export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`, DEFAULT_OPTS);
  if (!res.ok) throw new Error(`Stats fetch failed (${res.status})`);
  return res.json();
}
