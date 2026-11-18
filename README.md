# HeapVortex — 3D JVM Memory Profiler Dashboard

A full-stack JVM heap visualizer built with **React + Three.js** (frontend) and **Spring Boot** (backend). It renders 10,000 simulated heap objects as interactive GPU-instanced spheres in a 3D scene, alongside live memory metrics updated every 3 seconds.

## Architecture

```
┌─────────────────────┐        HTTP/JSON         ┌────────────────────────┐
│  React + Three.js   │ ◄──────────────────────► │  Spring Boot REST API  │
│  (Vite dev server)  │   /api/heap  /api/live   │  port 8080             │
└─────────────────────┘                           └────────────────────────┘
```

**Frontend** (`frontend/`):
- `App.jsx` — root component: 3D scene, metric cards, sparkline, GC feed, inspector
- `api.js` — thin fetch wrappers for `/api/heap` and `/api/live`
- `style.css` — dark-theme CSS (no CSS framework)

**Backend** (`backend/`):
- `HeapController` — `/api/heap` (10,000-node snapshot) and `/api/live` (live metrics)
- Models: `HeapNode`, `HeapEdge`, `HeapSnapshot`, `LiveMetrics`, `GcEvent`, `TopObject`
- `CorsConfig` — allows Vite dev-server origin during development

## Requirements

| Tool | Version |
|------|---------|
| JDK  | 21+     |
| Maven | 3.9+   |
| Node.js | 20+  |
| npm  | 10+     |

## Quick Start

**Terminal 1 — backend:**
```powershell
cd backend
mvn spring-boot:run
```
Verify: `http://localhost:8080/api/health` → `HeapVortex backend is running`

**Terminal 2 — frontend:**
```powershell
cd frontend
npm install
npm run dev
```
Open the Vite URL (usually `http://127.0.0.1:5173`).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `CORS error` in browser console | Ensure Spring Boot is on port 8080 and `CorsConfig` allows `http://localhost:5173` |
| `API request failed (404)` | Backend not running — start it first |
| Blank 3D canvas | WebGL not available; try Chrome/Edge |
| `npm install` fails | Delete `node_modules` and `package-lock.json`, then retry |

## Features

- **10,000 GPU-instanced nodes** rendered with `THREE.InstancedMesh` — single draw call per category
- **Live sawtooth GC simulation** — heap climbs 38 % → 83 % over a 42-second cycle
- **Sparkline trend chart** — last 50 samples, pure SVG, no chart library
- **Object Inspector** — click any sphere to see its class, shallow/retained size
- **GC Event Feed** — newest G1 Young / Old GC events with pause time and bytes freed
- **Top Memory Consumers** — 6 object types ranked by retained size, updated per tick
- **Keyboard shortcut** — press `R` to reset camera to default position

## Roadmap

1. Parse real `.hprof` heap dumps via Eclipse MAT APIs
2. Implement GC-root paths and accurate retained-size calculation
3. Secure JMX attachment (never expose JMX publicly)
4. WebSocket streaming for sub-second metric updates
5. Docker Compose for one-command local stack
6. Authentication + TLS for the REST API
7. Large-graph pagination / LOD for 100,000+ node dumps

> **Security note:** Never expose JMX endpoints publicly — they grant deep control over a running JVM.
