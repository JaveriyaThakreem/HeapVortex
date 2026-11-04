import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchHeap, fetchLive } from './api.js';

// ── colour palette (shared by 3-D scene and legend) ────────────────────────
const COLORS = {
  maps:        new THREE.Color('#e5a34b'),
  arrays:      new THREE.Color('#e84e86'),
  strings:     new THREE.Color('#a77bf5'),
  collections: new THREE.Color('#39d5a0'),
  threads:     new THREE.Color('#a77bf5'),
  objects:     new THREE.Color('#42c7e8'),
};

// ── formatters ──────────────────────────────────────────────────────────────
const fmtBytes = (n = 0) =>
  n < 1_024          ? `${n} B`
  : n < 1_048_576    ? `${(n / 1_024).toFixed(1)} KB`
  : n < 1_073_741_824 ? `${(n / 1_048_576).toFixed(1)} MB`
  : `${(n / 1_073_741_824).toFixed(2)} GB`;

const fmtUptime = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// ── Sparkline (pure SVG, no extra deps) ─────────────────────────────────────
function SparkLine({ history, maxVal }) {
  if (history.length < 2) {
    return <div className="sparkline-empty">Collecting data…</div>;
  }
  const W = 400, H = 58;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - Math.max(2, (v / maxVal) * H * 0.88 + H * 0.06);
    return [x, y];
  });
  const polyline = pts.map(p => p.join(',')).join(' ');
  const area     = `0,${H} ${polyline} ${W},${H}`;
  const last     = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="sparkline-svg">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#54d2e9" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#54d2e9" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon  points={area}     fill="url(#sg)" />
      <polyline points={polyline} fill="none" stroke="#54d2e9" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#54d2e9" />
    </svg>
  );
}

// ── 3-D heap scene (GPU-instanced, unchanged logic) ─────────────────────────
function HeapScene({ snapshot, onSelect }) {
  const mountRef = useRef(null);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !snapshot?.nodes?.length) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06101c');
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 1500);
    camera.position.set(0, 0, 265);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const light = new THREE.PointLight(0x77d9ff, 900);
    light.position.set(30, 80, 150);
    scene.add(light);

    // Build one InstancedMesh per category for minimal draw calls.
    const nodeIndex = new Map();
    const nodeMeshes = [];
    const temp = new THREE.Object3D();
    const nodeGeometry = new THREE.SphereGeometry(0.95, 7, 6);
    const grouped = new Map();

    snapshot.nodes.forEach((node, index) => {
      nodeIndex.set(node.id, index);
      const cat = node.category || 'objects';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push({ node, index });
    });

    for (const [category, entries] of grouped) {
      const mesh = new THREE.InstancedMesh(
        nodeGeometry,
        new THREE.MeshStandardMaterial({ color: COLORS[category] || COLORS.objects, roughness: 0.55, metalness: 0.05 }),
        entries.length
      );
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      entries.forEach(({ node, index }, instanceId) => {
        temp.position.set(node.x, node.y, node.z);
        temp.scale.setScalar(index === 5997 ? 1.9 : 0.72 + (index % 5) * 0.07);
        temp.updateMatrix();
        mesh.setMatrixAt(instanceId, temp.matrix);
        mesh.setColorAt(instanceId, COLORS[category] || COLORS.objects);
        mesh.userData.entryMap ||= [];
        mesh.userData.entryMap[instanceId] = { node, index };
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
      nodeMeshes.push(mesh);
    }

    // Reference edges as line segments.
    const positions = [];
    snapshot.edges.forEach(edge => {
      const si = nodeIndex.get(edge.source), ti = nodeIndex.get(edge.target);
      if (si === undefined || ti === undefined) return;
      const a = snapshot.nodes[si], b = snapshot.nodes[ti];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    scene.add(new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: '#24435b', transparent: true, opacity: 0.36 })
    ));

    // Interaction
    const raycaster = new THREE.Raycaster();
    raycaster.params.Mesh.threshold = 1;
    const pointer = new THREE.Vector2();
    let down = false, dragged = false, lastX = 0, lastY = 0;

    const onPointerDown = e => { down = true; dragged = false; lastX = e.clientX; lastY = e.clientY; };
    const onPointerUp   = () => { down = false; };
    const onPointerMove = e => {
      if (!down) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
      scene.rotation.y += dx * 0.003;
      scene.rotation.x += dy * 0.003;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onWheel = e => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.08, 120, 500);
    };
    const onClick = e => {
      if (dragged) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      if (!hits.length) return;
      const entry = hits[0].object.userData.entryMap?.[hits[0].instanceId];
      if (entry) selectRef.current(entry.node);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let frame;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) [].concat(obj.material).forEach(m => m.dispose());
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [snapshot]);

  return <div className="scene" ref={mountRef} />;
}

// ── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, detail, progress, delta }) {
  const barColor = progress > 78 ? '#ff6b6b' : progress > 58 ? '#ffc27a' : '#54d2e9';
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`metric-delta ${delta > 0 ? 'delta-up' : 'delta-dn'}`}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
          </span>
        )}
      </div>
      {/* key forces a re-render animation whenever value changes */}
      <strong key={value} className="metric-value">{value}</strong>
      <small>{detail}</small>
      {progress !== undefined && (
        <div className="progress">
          <i style={{ width: `${progress}%`, background: barColor }} />
        </div>
      )}
    </article>
  );
}

// ── GC events feed ───────────────────────────────────────────────────────────
function GcFeed({ events }) {
  return (
    <div className="gc-feed">
      {events.map(ev => (
        <div key={ev.id} className={`gc-event ${ev.type.includes('Old') ? 'gc-old' : 'gc-young'}`}>
          <div className="gc-row">
            <span className="gc-badge">{ev.type.includes('Old') ? 'OLD' : 'YNG'}</span>
            <span className="gc-name">{ev.type}</span>
            <span className="gc-ts">{ev.timestamp}</span>
          </div>
          <div className="gc-stats">
            <span className="gc-pause">⏱ {ev.pauseMs} ms</span>
            <span className="gc-freed">↓ {fmtBytes(ev.freedBytes)} freed</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Top memory consumers ─────────────────────────────────────────────────────
function TopObjects({ objects }) {
  const maxBytes = objects[0]?.totalRetainedBytes || 1;
  return (
    <div className="top-list">
      {objects.map((obj, i) => {
        const pct   = (obj.totalRetainedBytes / maxBytes) * 100;
        const short = obj.className.split('.').pop();
        return (
          <div key={obj.className} className="top-row">
            <span className="top-rank">#{i + 1}</span>
            <div className="top-info">
              <div className="top-name">{short}</div>
              <div className="top-bar-bg">
                <div className="top-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="top-nums">
              <span className="top-size">{fmtBytes(obj.totalRetainedBytes)}</span>
              <span className="top-inst">{obj.instances.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [snapshot,    setSnapshot]    = useState(null);
  const [metrics,     setMetrics]     = useState(null);
  const [prevMetrics, setPrevMetrics] = useState(null);
  const [history,     setHistory]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [error,       setError]       = useState('');
  const [secAgo,      setSecAgo]      = useState(null);
  const lastUpdatedRef = useRef(null);

  // Load the full 10,000-node snapshot once on mount.
  useEffect(() => {
    fetchHeap()
      .then(data => {
        setSnapshot(data);
        setSelected(data.nodes.find(n => n.id === 'obj-5997') || data.nodes[0]);
      })
      .catch(e => setError(`${e.message} — is the Spring Boot backend running?`));
  }, []);

  // Poll /api/live every 3 seconds for the living metrics.
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchLive();
        setMetrics(prev => { setPrevMetrics(prev); return data; });
        setHistory(h => [...h.slice(-49), data.usedHeapBytes]);
        lastUpdatedRef.current = Date.now();
        setError('');
      } catch (e) {
        setError(`Live metrics error: ${e.message}`);
      }
    };
    poll();
    const id = setInterval(poll, 3_000);
    return () => clearInterval(id);
  }, []);

  // "X s ago" ticker — updates every second.
  useEffect(() => {
    const id = setInterval(() => {
      if (lastUpdatedRef.current) {
        setSecAgo(Math.floor((Date.now() - lastUpdatedRef.current) / 1_000));
      }
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  const heapPct     = metrics ? Math.round(metrics.usedHeapBytes / metrics.maxHeapBytes * 100) : 0;
  const gcDelta     = (metrics && prevMetrics) ? metrics.gcCount     - prevMetrics.gcCount     : 0;
  const threadDelta = (metrics && prevMetrics) ? metrics.threadCount - prevMetrics.threadCount : 0;
  const histMin     = history.length ? fmtBytes(Math.min(...history)) : '—';
  const histMax     = history.length ? fmtBytes(Math.max(...history)) : '—';

  return (
    <main className="app-shell">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">H<span>V</span></div>
          <div>
            <div className="eyebrow">INFOTACT SOLUTIONS · JVM DIAGNOSTICS</div>
            <h1>HeapVortex <span>| 3D JVM Memory Profiler</span></h1>
            <p>Visual heap exploration and real-time object reference analysis</p>
          </div>
        </div>
        <div className="topbar-right">
          {secAgo !== null && (
            <span className="last-updated">
              updated {secAgo < 2 ? 'just now' : `${secAgo}s ago`}
            </span>
          )}
          <div className={`connection ${metrics ? 'live-conn' : ''}`}>
            <i className={metrics ? 'pulse-dot' : ''} />
            {metrics ? '● LIVE' : 'CONNECTING…'}
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Metric cards ────────────────────────────────────────────────── */}
      <section className="metrics-grid">
        <MetricCard
          label="HEAP USED"
          value={metrics ? fmtBytes(metrics.usedHeapBytes) : '—'}
          detail={`${heapPct}% of ${fmtBytes(metrics?.maxHeapBytes || 0)}`}
          progress={heapPct}
        />
        <MetricCard
          label="GC EVENTS"
          value={metrics ? metrics.gcCount.toLocaleString() : '—'}
          detail="Cumulative garbage collections"
          delta={gcDelta}
        />
        <MetricCard
          label="LIVE THREADS"
          value={metrics ? metrics.threadCount : '—'}
          detail="Active JVM threads"
          delta={threadDelta}
        />
        <MetricCard
          label="JVM UPTIME"
          value={metrics ? fmtUptime(metrics.uptimeSeconds) : '—'}
          detail="HH : MM : SS"
        />
      </section>

      {/* ── Main two-column grid ─────────────────────────────────────────── */}
      <section className="main-grid">

        {/* Left column: trend chart + 3-D graph */}
        <div className="left-col">

          {/* Heap trend */}
          <section className="card trend-card">
            <div className="card-heading">
              <div>
                <h2>Heap Usage Trend</h2>
                <p>Live sawtooth GC cycle · 3-second poll · last 50 samples</p>
              </div>
              <span className="snapshot-pill">
                {history.length > 0 ? `${heapPct}% NOW` : 'COLLECTING…'}
              </span>
            </div>
            <div className="trend-body">
              <SparkLine history={history} maxVal={metrics?.maxHeapBytes || 2_147_483_648} />
              {history.length > 1 && (
                <div className="trend-axis">
                  <span>Low: {histMin}</span>
                  <span className="axis-mid">
                    Max: {fmtBytes(metrics?.maxHeapBytes || 0)}
                  </span>
                  <span>High: {histMax}</span>
                </div>
              )}
            </div>
          </section>

          {/* 3-D graph */}
          <section className="card graph-card">
            <div className="card-heading">
              <div>
                <h2>Heap Object Graph</h2>
                <p>Drag to rotate · scroll to zoom · click a node to inspect</p>
              </div>
              <span className="snapshot-pill">
                {snapshot ? '10,000-NODE SNAPSHOT' : 'LOADING GRAPH…'}
              </span>
            </div>
            {snapshot
              ? <HeapScene snapshot={snapshot} onSelect={setSelected} />
              : <div className="loading">Fetching 10,000 objects from the API…</div>}
            <div className="legend">
              <span><i className="dot maps"       />Maps / Caches</span>
              <span><i className="dot arrays"     />Arrays / Buffers</span>
              <span><i className="dot strings"    />Strings / Threads</span>
              <span><i className="dot collections"/>Collections</span>
              <span><i className="dot objects"    />Generic Objects</span>
            </div>
          </section>
        </div>

        {/* Right column: inspector + top consumers + GC events */}
        <aside className="right-col">

          {/* Object inspector */}
          <section className="card inspector-card">
            <div className="card-heading">
              <div><h2>Object Inspector</h2><p>Click any sphere to inspect</p></div>
            </div>
            {selected ? (
              <div className="inspector-content">
                <div className="object-icon">◎</div>
                <h3>{selected.label}</h3>
                <p className="class-name">{selected.className}</p>
                <div className="detail-row"><span>Object ID</span>     <strong>{selected.id}</strong></div>
                <div className="detail-row"><span>Shallow size</span>  <strong>{fmtBytes(selected.shallowSizeBytes)}</strong></div>
                <div className="detail-row"><span>Retained size</span> <strong>{fmtBytes(selected.retainedSizeBytes)}</strong></div>
                <div className="detail-row"><span>Category</span>      <strong style={{ textTransform: 'capitalize' }}>{selected.category}</strong></div>
                <div className="notice">Simulated values — connect JMX / Eclipse MAT for real measurements.</div>
              </div>
            ) : (
              <p className="loading">Select a sphere in the graph.</p>
            )}
          </section>

          {/* Top memory consumers */}
          <section className="card top-card">
            <div className="card-heading">
              <div><h2>Top Memory Consumers</h2><p>By retained heap size · live</p></div>
            </div>
            {metrics?.topObjects
              ? <TopObjects objects={metrics.topObjects} />
              : <p className="loading">Waiting for live data…</p>}
          </section>

          {/* GC event feed */}
          <section className="card gc-card">
            <div className="card-heading">
              <div><h2>GC Events</h2><p>Recent garbage collections</p></div>
              <span className="snapshot-pill gc-pill">SIMULATED</span>
            </div>
            {metrics?.recentGcEvents?.length
              ? <GcFeed events={metrics.recentGcEvents} />
              : <p className="loading">Waiting for GC data…</p>}
          </section>

        </aside>
      </section>

      <footer>
        <span>HeapVortex · GPU-instanced graph · live metrics every 3 s</span>
        <span>Simulated JVM — real integration is a future milestone</span>
      </footer>
    </main>
  );
}
