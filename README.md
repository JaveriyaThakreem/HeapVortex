# HeapVortex — 3D JVM Memory Profiler Dashboard

This is a complete runnable dashboard starter with a Spring Boot API and a React/Three.js frontend. It renders 10,000 simulated object nodes using Three.js `InstancedMesh`, with a graph view and object inspector in one dashboard.

## Important accuracy note
The 10,000 nodes and memory figures are generated sample data so the dashboard can be tested without risking a real JVM. This version does not yet attach to a real JVM, parse `.hprof` files, or calculate actual retained sizes. The UI labels the source as a simulated snapshot. Replace the sample-data service with real JMX / Eclipse MAT integration for measured values.

## Requirements
- JDK 21+
- Maven 3.9+
- Node.js 20+ and npm
- VS Code

## Start backend
Terminal 1:
```powershell
cd backend
mvn spring-boot:run
```
Test `http://localhost:8080/api/heap`

## Start frontend
Terminal 2:
```powershell
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.

Keep both terminals open. The backend provides the API; the frontend displays it.

## Main features
- One dark dashboard with metric cards, 3D graph, legend and inspector
- 10,000 nodes rendered with GPU instancing
- Drag to rotate, scroll to zoom, click a node to inspect
- Spring Boot REST API and generated sample graph

## Next milestones for the actual assignment
1. Parse `.hprof` heap dumps through Eclipse MAT APIs.
2. Implement paths to GC Roots and reliable retained-size analysis.
3. Connect only to authorized JVMs via secured JMX.
4. Add WebSocket streaming, authentication/TLS, Docker and large-graph tests.
Never expose JMX publicly; it can grant powerful control over a JVM.
