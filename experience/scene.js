import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════
   SCENE.JS — 3D-First Spatial Interface (v2 — VISIBLE)
   Brighter objects, grid floor, connecting lines, red atmosphere
   Camera-driven scroll · Red emissive interactions
   ═══════════════════════════════════════════════════════════════ */

export const getWebGLSupport = () => {
  try {
    if (!window.WebGLRenderingContext) {
      return { supported: false, reason: "WebGLRenderingContext is unavailable." };
    }
    const c = document.createElement("canvas");
    const gl2 = c.getContext("webgl2");
    if (gl2) return { supported: true, contextType: "webgl2" };
    const gl = c.getContext("webgl");
    if (gl) return { supported: true, contextType: "webgl" };
    return { supported: false, reason: "Canvas could not create a WebGL context." };
  } catch (e) {
    return { supported: false, reason: e instanceof Error ? e.message : String(e) };
  }
};

export const supportsWebGL = () => getWebGLSupport().supported;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ─── Node Geometry (from project data) ─── */
const createNodeGeometry = (project) => {
  const s = (project.scale ?? 0.5) * 1.4; // 40% bigger for visibility
  switch (project.geometry) {
    case "sphere":       return new THREE.IcosahedronGeometry(0.86 * s, 1);
    case "torus":        return new THREE.TorusGeometry(0.66 * s, 0.18 * s, 12, 56);
    case "icosahedron":  return new THREE.IcosahedronGeometry(0.92 * s, 0);
    case "dodecahedron": return new THREE.DodecahedronGeometry(0.84 * s, 0);
    case "sense-stick":
      return typeof THREE.CapsuleGeometry === "function"
        ? new THREE.CapsuleGeometry(0.14 * s, 0.92 * s, 6, 12)
        : new THREE.CylinderGeometry(0.11 * s, 0.15 * s, 1.02 * s, 16);
    default:             return new THREE.BoxGeometry(0.9 * s, 0.9 * s, 0.9 * s);
  }
};

/* ─── Spatial Layout ─── */
const NODE_POSITIONS = [
  { x:  1.4,  y:  0.3,  z:  0.0  },
  { x: -2.0,  y: -0.1,  z: -3.5  },
  { x:  1.8,  y:  0.4,  z: -7.0  },
  { x: -1.4,  y: -0.3,  z: -10.5 },
  { x:  1.6,  y:  0.2,  z: -14.0 },
];

/* ─── Camera Keyframes ─── */
const CAMERA_KEYFRAMES = [
  { x: 0, y: 1.2, z: 7,    lookX: 0,    lookY: 0,    lookZ: -2   },
  { x: 0, y: 0.5, z: 2,    lookX: 1.4,  lookY: 0.3,  lookZ: 0    },
  { x: 0, y: 0.1, z: -1.5, lookX: -2,   lookY: -0.1, lookZ: -3.5 },
  { x: 0, y: 0.5, z: -5,   lookX: 1.8,  lookY: 0.4,  lookZ: -7   },
  { x: 0, y: -0.1, z: -8.5, lookX: -1.4, lookY: -0.3, lookZ: -10.5 },
  { x: 0, y: 0.3, z: -12,  lookX: 1.6,  lookY: 0.2,  lookZ: -14  },
  { x: 0, y: 0.8, z: -16,  lookX: 0,    lookY: 0,    lookZ: -20  },
];

export const createExperienceScene = async ({
  canvas,
  projects,
  onReady,
  onQualityChange,
  onNodeHover,
  onNodeLeave,
  onNodeClick,
}) => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isCompact = window.matchMedia("(max-width: 820px)").matches;

  const trackedGeo = new Set();
  const trackedMat = new Set();
  const trackedTex = new Set();
  const trackG = (g) => { trackedGeo.add(g); return g; };
  const trackM = (m) => { trackedMat.add(m); return m; };
  const trackT = (t) => { trackedTex.add(t); return t; };

  /* ─── Renderer ─── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: !isCompact,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompact ? 1.5 : 2));
  renderer.setClearColor(0x030303, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  /* ─── Scene ─── */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030303, isCompact ? 0.025 : 0.018);

  /* ─── Camera ─── */
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 1.2, 7);
  scene.add(camera);

  /* ═══ LIGHTING (much brighter) ═══ */
  const ambient = new THREE.AmbientLight(0x222222, 1.2);

  const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  keyLight.position.set(4, 6, 10);

  const rimLight = new THREE.PointLight(0xff3b30, 6, 40, 1.2);
  rimLight.position.set(-6, 3, 2);

  const fillLight = new THREE.PointLight(0xff2222, 3, 40, 1.2);
  fillLight.position.set(4, -2, -10);

  const backLight = new THREE.PointLight(0xff3b30, 4, 50, 1);
  backLight.position.set(0, 2, -18);

  const followLight = new THREE.PointLight(0xff3b30, 2.5, 18, 1.5);
  scene.add(followLight);

  scene.add(ambient, keyLight, rimLight, fillLight, backLight);

  /* ═══ GROUND GRID — subtle spatial reference ═══ */
  const gridGroup = new THREE.Group();
  const gridSize = 40;
  const gridDivisions = 40;
  const gridStep = gridSize / gridDivisions;
  const gridY = -1.8;

  // Horizontal lines (along X, repeating Z)
  for (let i = 0; i <= gridDivisions; i++) {
    const z = -gridSize / 2 + i * gridStep;
    const points = [
      new THREE.Vector3(-gridSize / 2, gridY, z),
      new THREE.Vector3(gridSize / 2, gridY, z),
    ];
    const geo = trackG(new THREE.BufferGeometry().setFromPoints(points));
    const mat = trackM(new THREE.LineBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: i % 4 === 0 ? 0.08 : 0.03,
    }));
    gridGroup.add(new THREE.Line(geo, mat));
  }
  // Vertical lines (along Z, repeating X)
  for (let i = 0; i <= gridDivisions; i++) {
    const x = -gridSize / 2 + i * gridStep;
    const points = [
      new THREE.Vector3(x, gridY, -gridSize / 2),
      new THREE.Vector3(x, gridY, gridSize / 2),
    ];
    const geo = trackG(new THREE.BufferGeometry().setFromPoints(points));
    const mat = trackM(new THREE.LineBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: i % 4 === 0 ? 0.08 : 0.03,
    }));
    gridGroup.add(new THREE.Line(geo, mat));
  }
  scene.add(gridGroup);

  /* ═══ CONNECTING LINES between nodes ═══ */
  const connectionGroup = new THREE.Group();
  for (let i = 0; i < NODE_POSITIONS.length - 1; i++) {
    const a = NODE_POSITIONS[i];
    const b = NODE_POSITIONS[i + 1];
    const points = [
      new THREE.Vector3(a.x, a.y, a.z),
      new THREE.Vector3(b.x, b.y, b.z),
    ];
    const geo = trackG(new THREE.BufferGeometry().setFromPoints(points));
    const mat = trackM(new THREE.LineBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.12,
    }));
    connectionGroup.add(new THREE.Line(geo, mat));
  }
  scene.add(connectionGroup);

  /* ═══ VERTICAL PILLARS under each node ═══ */
  NODE_POSITIONS.forEach((pos) => {
    const points = [
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Vector3(pos.x, gridY, pos.z),
    ];
    const geo = trackG(new THREE.BufferGeometry().setFromPoints(points));
    const mat = trackM(new THREE.LineBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.06,
    }));
    connectionGroup.add(new THREE.Line(geo, mat));
  });

  /* ─── Glow Texture ─── */
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const gCtx = glowCanvas.getContext("2d");
  const grad = gCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.2, "rgba(255,255,255,0.6)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.15)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, 128, 128);
  const glowTex = trackT(new THREE.CanvasTexture(glowCanvas));

  /* ═══ BACKGROUND NEBULA — distant atmospheric glow ═══ */
  const nebulaPositions = [
    { x: -8, y: 2, z: -25, s: 12, c: 0xff1a1a },
    { x: 6, y: -1, z: -15, s: 10, c: 0xff3b30 },
    { x: -4, y: 4, z: -8, s: 8, c: 0xff2222 },
    { x: 3, y: -3, z: -22, s: 14, c: 0x661111 },
    { x: -2, y: 1, z: 5, s: 9, c: 0xff3b30 },
  ];
  nebulaPositions.forEach((n) => {
    const nebMat = trackM(new THREE.SpriteMaterial({
      map: glowTex,
      color: n.c,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const nebula = new THREE.Sprite(nebMat);
    nebula.position.set(n.x, n.y, n.z);
    nebula.scale.set(n.s, n.s, 1);
    scene.add(nebula);
  });

  /* ═══ PROJECT NODES (brighter, more visible) ═══ */
  const nodes = [];
  const rayTargets = [];

  projects.forEach((project, i) => {
    const pos = NODE_POSITIONS[i] || { x: 0, y: 0, z: -i * 3.5 };
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);

    const accentCol = new THREE.Color(project.accent);

    // Main mesh — BRIGHTER base, always visible
    const geo = trackG(createNodeGeometry(project));
    const mat = trackM(new THREE.MeshPhysicalMaterial({
      color: 0x2a2a2a,
      emissive: 0x1a0505,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: false,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.projectIndex = i;
    group.add(mesh);

    // Edge wireframe — visible by default
    const edgeGeo = trackG(new THREE.EdgesGeometry(geo, 16));
    const edgeMat = trackM(new THREE.LineBasicMaterial({
      color: accentCol,
      transparent: true,
      opacity: 0.18,
    }));
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    group.add(edges);

    // Glow sprite
    const auraMat = trackM(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xff3b30,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const aura = new THREE.Sprite(auraMat);
    const auraSize = (project.scale ?? 0.5) * 3.5;
    aura.scale.set(auraSize, auraSize, 1);
    group.add(aura);

    // Orbital ring
    const orbitGeo = trackG(new THREE.TorusGeometry((project.scale ?? 0.5) * 1.3, 0.009, 8, 56));
    const orbitMat = trackM(new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
    }));
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI * 0.4;
    group.add(orbit);

    // Second orbit (crossed)
    const orbit2Geo = trackG(new THREE.TorusGeometry((project.scale ?? 0.5) * 1.5, 0.006, 8, 56));
    const orbit2Mat = trackM(new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
    }));
    const orbit2 = new THREE.Mesh(orbit2Geo, orbit2Mat);
    orbit2.rotation.x = Math.PI * 0.7;
    orbit2.rotation.z = Math.PI * 0.3;
    group.add(orbit2);

    // Per-node point light for local illumination
    const nodeLight = new THREE.PointLight(0xff3b30, 0.8, 5, 2);
    nodeLight.position.set(0, 0, 0);
    group.add(nodeLight);

    group.userData = {
      index: i,
      project,
      mesh,
      edges,
      aura,
      orbit,
      orbit2,
      orbit2Mat,
      nodeLight,
      mat,
      edgeMat,
      auraMat,
      orbitMat,
      baseY: pos.y,
      floatPhase: Math.random() * Math.PI * 2,
      floatSpeed: 0.4 + i * 0.05,
      spinSpeed: 0.1 + i * 0.015,
      isHovered: false,
    };

    group.scale.setScalar(0);
    scene.add(group);
    nodes.push(group);
    rayTargets.push(mesh);
  });

  /* ═══ DUST PARTICLES (more, bigger, mixed colors) ═══ */
  const pCount = reducedMotion ? 15 : isCompact ? 40 : 80;
  const pPos = new Float32Array(pCount * 3);
  const pColors = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const s = i * 3;
    const r = 1.5 + Math.random() * 8;
    const theta = Math.random() * Math.PI * 2;
    pPos[s] = Math.cos(theta) * r;
    pPos[s + 1] = (Math.random() - 0.5) * 5;
    pPos[s + 2] = 5 - Math.random() * 28;
    // Mix red and warm white
    if (Math.random() > 0.6) {
      pColors[s] = 1; pColors[s + 1] = 0.23; pColors[s + 2] = 0.19; // red
    } else {
      const w = 0.5 + Math.random() * 0.5;
      pColors[s] = w; pColors[s + 1] = w * 0.9; pColors[s + 2] = w * 0.85; // warm white
    }
  }
  const pGeo = trackG(new THREE.BufferGeometry());
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pColors, 3));
  const pMat = trackM(new THREE.PointsMaterial({
    size: isCompact ? 0.025 : 0.03,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    vertexColors: true,
  }));
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ─── State ─── */
  const state = {
    scrollProgress: 0,
    hoverIndex: null,
    focusedIndex: -1,
    pointerX: 0,
    pointerY: 0,
    entranceReady: false,
  };

  const pointer = new THREE.Vector2(5, 5);
  const raycaster = new THREE.Raycaster();
  const clock = new THREE.Clock();
  const lookTarget = new THREE.Vector3();
  const currentLookTarget = new THREE.Vector3(0, 0, -2);

  /* ─── Resize ─── */
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(canvas);
  window.addEventListener("resize", resize);
  resize();

  /* ─── Raycasting ─── */
  const getPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const pickNode = () => {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(rayTargets, false)[0];
    return hit ? hit.object.userData.projectIndex : null;
  };

  const setHoverIndex = (idx) => {
    if (state.hoverIndex === idx) return;
    const prevIdx = state.hoverIndex;
    state.hoverIndex = idx;
    canvas.classList.toggle("is-interactive", idx !== null);

    if (prevIdx !== null) {
      const prev = nodes[prevIdx];
      if (prev) prev.userData.isHovered = false;
      onNodeLeave?.(prevIdx);
    }
    if (idx !== null) {
      const n = nodes[idx];
      if (n) n.userData.isHovered = true;
      onNodeHover?.(idx);
    }
  };

  const handlePointerMove = (e) => {
    getPointer(e);
    state.pointerX = pointer.x;
    state.pointerY = pointer.y;
    if (finePointer || e.pointerType === "mouse") {
      setHoverIndex(pickNode());
    }
  };

  const handlePointerDown = (e) => {
    getPointer(e);
    const idx = pickNode();
    if (idx !== null) {
      onNodeClick?.(idx);
    }
  };

  const handlePointerLeave = () => {
    state.pointerX = 0;
    state.pointerY = 0;
    setHoverIndex(null);
  };

  canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerleave", handlePointerLeave);

  /* ─── Loader ─── */
  const loaderEls = {
    container: document.getElementById("loader-ui"),
    phase: document.getElementById("loader-phase"),
    percentage: document.getElementById("loader-percentage"),
    track: document.getElementById("loader-track"),
    fill: document.getElementById("loader-track-fill"),
  };

  const loaderPhases = [
    { threshold: 18, label: "Aligning signal lattice" },
    { threshold: 42, label: "Translating project vectors" },
    { threshold: 72, label: "Bending interface horizon" },
    { threshold: 96, label: "Opening dimensional seam" },
    { threshold: 100, label: "Field stabilized" },
  ];

  let readyFired = false;
  let loaderFrameId = null;

  const qualityLabel = reducedMotion
    ? "Reduced motion / minimal"
    : isCompact
    ? "Adaptive / mobile"
    : "Adaptive / cinematic";

  onQualityChange?.(qualityLabel);

  const signalReady = () => {
    if (readyFired) return;
    readyFired = true;
    state.entranceReady = true;
    onReady?.(qualityLabel);
  };

  const updateLoader = (val) => {
    const p = clamp(Math.round(val), 0, 100);
    const label = loaderPhases.find((ph) => p <= ph.threshold)?.label ?? "Field stabilized";
    if (loaderEls.phase) loaderEls.phase.textContent = label;
    if (loaderEls.percentage) loaderEls.percentage.textContent = `${p}%`;
    if (loaderEls.track) loaderEls.track.setAttribute("aria-valuenow", String(p));
    if (loaderEls.fill) loaderEls.fill.style.transform = `scaleX(${p / 100})`;
  };

  const runLoader = () => {
    if (!loaderEls.container) {
      signalReady();
      return;
    }
    const dur = reducedMotion ? 1200 : 1800;
    const start = performance.now();
    const step = (ts) => {
      const raw = clamp((ts - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      updateLoader(eased * 100);
      if (raw < 1) {
        loaderFrameId = requestAnimationFrame(step);
        return;
      }
      updateLoader(100);
      loaderEls.container.classList.add("fade-out");
      signalReady();
    };
    updateLoader(0);
    loaderFrameId = requestAnimationFrame(step);
  };

  /* ─── Interpolation ─── */
  const lerpVal = (a, b, t) => a + (b - a) * t;

  const getCameraFromScroll = (progress) => {
    const kf = CAMERA_KEYFRAMES;
    const totalSegments = kf.length - 1;
    const segProgress = progress * totalSegments;
    const segIndex = Math.floor(clamp(segProgress, 0, totalSegments - 0.001));
    const segT = clamp(segProgress - segIndex, 0, 1);
    const smoothT = segT * segT * (3 - 2 * segT);
    const a = kf[segIndex];
    const b = kf[segIndex + 1] || a;
    return {
      x: lerpVal(a.x, b.x, smoothT),
      y: lerpVal(a.y, b.y, smoothT),
      z: lerpVal(a.z, b.z, smoothT),
      lookX: lerpVal(a.lookX, b.lookX, smoothT),
      lookY: lerpVal(a.lookY, b.lookY, smoothT),
      lookZ: lerpVal(a.lookZ, b.lookZ, smoothT),
    };
  };

  const getFocusedProject = (progress) => {
    const totalSections = projects.length + 2;
    const sectionSize = 1 / totalSections;
    const projectStart = sectionSize;
    if (progress < projectStart) return -1;
    const projectProgress = (progress - projectStart) / (sectionSize * projects.length);
    const idx = Math.floor(projectProgress * projects.length);
    if (idx >= projects.length) return -1;
    return idx;
  };

  /* ═══ ANIMATE LOOP ═══ */
  const targetScaleVec = new THREE.Vector3();

  const animate = () => {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    // Camera from scroll
    const cam = getCameraFromScroll(state.scrollProgress);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, cam.x, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, cam.y, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, cam.z, 0.05);

    // Pointer parallax
    if (finePointer) {
      camera.position.x += state.pointerX * 0.12;
      camera.position.y += state.pointerY * 0.06;
    }

    // Smooth lookAt
    lookTarget.set(cam.lookX, cam.lookY, cam.lookZ);
    currentLookTarget.lerp(lookTarget, 0.04);
    camera.lookAt(currentLookTarget);

    // Follow light tracks camera
    followLight.position.set(
      camera.position.x - 1.5,
      camera.position.y + 1.5,
      camera.position.z - 2
    );

    // Focused project
    const focusIdx = getFocusedProject(state.scrollProgress);
    state.focusedIndex = focusIdx;

    // Particle drift
    particles.rotation.y += delta * 0.005;
    particles.position.y = Math.sin(elapsed * 0.1) * 0.15;

    // Grid subtle breathing
    gridGroup.position.y = gridY + Math.sin(elapsed * 0.15) * 0.02;

    // Nodes
    nodes.forEach((node) => {
      const d = node.userData;
      const isHover = d.isHovered;
      const isFocus = d.index === focusIdx;
      const isAny = isHover || isFocus;

      // Idle rotation — NEVER static
      node.rotation.y += delta * d.spinSpeed * (isAny ? 3.5 : 1);
      node.rotation.x = Math.sin(elapsed * 0.25 + d.floatPhase) * 0.06;

      // Floating
      const floatAmp = reducedMotion ? 0.01 : 0.06;
      node.position.y = d.baseY + Math.sin(elapsed * d.floatSpeed + d.floatPhase) * floatAmp;

      // Scale: entrance + interaction feedback
      const scaleVal = state.entranceReady ? (isHover ? 1.18 : isFocus ? 1.1 : 1) : 0;
      node.scale.lerp(
        targetScaleVec.setScalar(scaleVal),
        state.entranceReady ? 0.05 : 0.1
      );

      // Emissive — always slightly visible, RED on interaction
      const baseEmissive = 0.3;
      const targetEmissive = isHover ? 1.2 : isFocus ? 0.8 : baseEmissive;
      d.mat.emissiveIntensity = THREE.MathUtils.lerp(d.mat.emissiveIntensity, targetEmissive, 0.06);
      d.mat.emissive.setHex(isAny ? 0xff3b30 : 0x1a0505);

      // Edge glow
      d.edgeMat.opacity = THREE.MathUtils.lerp(d.edgeMat.opacity, isAny ? 0.6 : 0.15, 0.06);
      d.edgeMat.color.setHex(isAny ? 0xff3b30 : new THREE.Color(d.project.accent).getHex());

      // Aura — always a subtle glow, stronger on interaction
      d.auraMat.opacity = THREE.MathUtils.lerp(d.auraMat.opacity, isHover ? 0.6 : isFocus ? 0.35 : 0.08, 0.05);

      // Orbits
      d.orbitMat.opacity = THREE.MathUtils.lerp(d.orbitMat.opacity, isAny ? 0.25 : 0.06, 0.05);
      d.orbit.rotation.z += delta * (isAny ? 0.8 : 0.2);

      d.orbit2Mat.opacity = THREE.MathUtils.lerp(d.orbit2Mat.opacity, isAny ? 0.15 : 0.03, 0.05);
      d.orbit2.rotation.z -= delta * (isAny ? 0.5 : 0.12);

      // Per-node light intensity
      const targetLightIntensity = isHover ? 3 : isFocus ? 1.8 : 0.8;
      d.nodeLight.intensity = THREE.MathUtils.lerp(d.nodeLight.intensity, targetLightIntensity, 0.06);
    });

    renderer.render(scene, camera);
  };

  /* ─── Visibility ─── */
  const handleVisibility = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
    } else {
      clock.getDelta();
      renderer.setAnimationLoop(animate);
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  renderer.setAnimationLoop(animate);
  runLoader();

  /* ─── Public API ─── */
  return {
    setScrollProgress(p) {
      state.scrollProgress = clamp(p, 0, 1);
    },

    getFocusedIndex() {
      return state.focusedIndex;
    },

    destroy() {
      renderer.setAnimationLoop(null);
      resizeObs.disconnect();
      if (loaderFrameId !== null) cancelAnimationFrame(loaderFrameId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      trackedGeo.forEach((g) => g.dispose());
      trackedMat.forEach((m) => m.dispose());
      trackedTex.forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
};
