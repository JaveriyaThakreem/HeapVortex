import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchHeap } from './api.js';

const COLORS = {
  maps: new THREE.Color('#e5a34b'),
  arrays: new THREE.Color('#e84e86'),
  strings: new THREE.Color('#a77bf5'),
  collections: new THREE.Color('#39d5a0'),
  threads: new THREE.Color('#a77bf5'),
  objects: new THREE.Color('#42c7e8')
};
const fmtBytes = (n = 0) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

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

    // One GPU-instanced draw per category keeps 10,000 objects interactive.
    const nodeIndex = new Map();
    const nodeMeshes = [];
    const temp = new THREE.Object3D();
    const nodeGeometry = new THREE.SphereGeometry(0.95, 7, 6);
    const grouped = new Map();
    snapshot.nodes.forEach((node, index) => {
      nodeIndex.set(node.id, index);
      const category = node.category || 'objects';
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push({ node, index });
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
        const scale = index === 5997 ? 1.9 : 0.72 + (index % 5) * 0.07;
        temp.scale.setScalar(scale);
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

    // Lines represent references; generated graph is a sample binary tree.
    const positions = [];
    snapshot.edges.forEach(edge => {
      const si = nodeIndex.get(edge.source), ti = nodeIndex.get(edge.target);
      if (si === undefined || ti === undefined) return;
      const a = snapshot.nodes[si], b = snapshot.nodes[ti];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: '#24435b', transparent: true, opacity: 0.36 }));
    scene.add(lines);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Mesh.threshold = 1;
    const pointer = new THREE.Vector2();
    let down = false, dragged = false, lastX = 0, lastY = 0;
    const onPointerDown = e => { down = true; dragged = false; lastX = e.clientX; lastY = e.clientY; };
    const onPointerUp = () => { down = false; };
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
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      if (!hits.length) return;
      const hit = hits[0];
      const entry = hit.object.userData.entryMap?.[hit.instanceId];
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
        if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [snapshot]);

  return <div className="scene" ref={mountRef} />;
}

function Metric({ label, value, detail, progress }) {
  return <article className="metric-card"><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small>{progress !== undefined && <div className="progress"><i style={{ width: `${progress}%` }} /></div>}</article>;
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHeap().then(data => {
      setSnapshot(data);
      setSelected(data.nodes.find(n => n.id === 'obj-5997') || data.nodes[0]);
    }).catch(e => setError(`${e.message}. Start the Spring Boot backend in the backend terminal.`));
  }, []);

  const percent = snapshot ? Math.round(snapshot.usedHeapBytes / snapshot.maxHeapBytes * 100) : 0;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">H<span>V</span></div>
        <div><div className="eyebrow">INFOTACT SOLUTIONS · JVM DIAGNOSTICS</div><h1>HeapVortex <span>| 3D JVM Memory Profiler</span></h1><p>Visual heap exploration and object reference analysis</p></div>
      </div>
      <div className="connection"><i className={snapshot ? 'online' : ''}/>{snapshot ? 'API CONNECTED' : 'CONNECTING'}</div>
    </header>

    {error && <div className="error-banner">{error}</div>}

    <section className="metrics-grid">
      <Metric label="HEAP USED" value={snapshot ? fmtBytes(snapshot.usedHeapBytes) : '—'} detail={`${percent}% of max heap`} progress={percent}/>
      <Metric label="MAX HEAP" value={snapshot ? fmtBytes(snapshot.maxHeapBytes) : '—'} detail="Configured limit"/>
      <Metric label="OBJECT NODES" value={snapshot ? snapshot.objectCount.toLocaleString() : '—'} detail="Rendered via GPU instancing"/>
      <Metric label="REFERENCES" value={snapshot ? snapshot.edges.length.toLocaleString() : '—'} detail="Object-to-object links"/>
    </section>

    <section className="main-grid">
      <section className="graph-card">
        <div className="card-heading">
          <div><h2>Heap Object Graph</h2><p>Drag to rotate · scroll to zoom · click a node to inspect</p></div>
          <span className="snapshot-pill">{snapshot ? '10,000-NODE SNAPSHOT' : 'LOADING GRAPH'}</span>
        </div>
        {snapshot ? <HeapScene snapshot={snapshot} onSelect={setSelected}/> : <div className="loading">Loading object graph…</div>}
        <div className="legend">
          <span><i className="dot maps"/>Maps / Caches</span>
          <span><i className="dot arrays"/>Arrays / Buffers</span>
          <span><i className="dot strings"/>Strings / Threads</span>
          <span><i className="dot collections"/>Collections</span>
          <span><i className="dot objects"/>Generic Objects</span>
        </div>
      </section>

      <aside className="inspector-card">
        <div className="card-heading"><div><h2>Object Inspector</h2><p>Selected node details</p></div></div>
        {selected ? <div className="inspector-content">
          <div className="object-icon">◎</div>
          <h3>{selected.label}</h3>
          <p className="class-name">{selected.className}</p>
          <div className="detail-row"><span>Object ID</span><strong>{selected.id}</strong></div>
          <div className="detail-row"><span>Shallow size</span><strong>{fmtBytes(selected.shallowSizeBytes)}</strong></div>
          <div className="detail-row"><span>Retained size</span><strong>{fmtBytes(selected.retainedSizeBytes)}</strong></div>
          <div className="detail-row"><span>Graph position</span><strong>({selected.x.toFixed(1)}, {selected.y.toFixed(1)}, {selected.z.toFixed(1)})</strong></div>
          <div className="notice">Sample snapshot values. Connect a real JVM / heap analyzer to show measured memory values.</div>
        </div> : <p className="loading">Select a sphere in the graph to inspect it.</p>}
      </aside>
    </section>
    <footer><span>HeapVortex · GPU-instanced graph rendering</span><span>Simulated snapshot — real JVM integration is a future milestone</span></footer>
  </main>;
}
