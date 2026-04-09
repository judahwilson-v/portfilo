import * as THREE from "three";

const PROJECT_LAYOUTS = {
  regular: [
    {
      position: [0, 1.18, 0.24],
      focusYaw: 0.04,
    },
    {
      position: [-1.9, 0.48, 1.15],
      focusYaw: 0.18,
    },
    {
      position: [1.96, 0.42, 1.12],
      focusYaw: -0.18,
    },
    {
      position: [-1.18, -1.24, 1.96],
      focusYaw: 0.08,
    },
    {
      position: [1.24, -1.16, 2.18],
      focusYaw: -0.08,
    },
  ],
  compact: [
    {
      position: [0, 0.98, 0.34],
      focusYaw: 0.03,
    },
    {
      position: [-1.34, 0.34, 0.96],
      focusYaw: 0.12,
    },
    {
      position: [1.38, 0.28, 0.94],
      focusYaw: -0.12,
    },
    {
      position: [-0.9, -1.02, 1.52],
      focusYaw: 0.05,
    },
    {
      position: [0.94, -0.96, 1.64],
      focusYaw: -0.05,
    },
  ],
};

export const getWebGLSupport = () => {
  try {
    if (!window.WebGLRenderingContext) {
      return {
        supported: false,
        reason: "WebGLRenderingContext is unavailable in this browser.",
      };
    }

    const testCanvas = document.createElement("canvas");
    const webgl2Context = testCanvas.getContext("webgl2");

    if (webgl2Context) {
      return {
        supported: true,
        contextType: "webgl2",
      };
    }

    const webglContext = testCanvas.getContext("webgl");

    if (webglContext) {
      return {
        supported: true,
        contextType: "webgl",
      };
    }

    return {
      supported: false,
      reason: "Canvas could not create a WebGL2 or WebGL rendering context.",
    };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

export const supportsWebGL = () => getWebGLSupport().supported;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const createGlowTexture = async (THREE) => {
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 256;
  glowCanvas.height = 256;

  const context = glowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 18, 128, 128, 128);

  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.24, "rgba(255, 255, 255, 0.75)");
  gradient.addColorStop(0.52, "rgba(255, 255, 255, 0.16)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, glowCanvas.width, glowCanvas.height);

  const texture = new THREE.CanvasTexture(glowCanvas);
  texture.needsUpdate = true;

  return texture;
};

const createNodeGeometry = (THREE, project) => {
  const scale = project.scale;

  switch (project.geometry) {
    case "octahedron":
      return new THREE.OctahedronGeometry(0.94 * scale, 0);
    case "sphere":
      return new THREE.IcosahedronGeometry(0.86 * scale, 1);
    case "torus":
      return new THREE.TorusGeometry(0.66 * scale, 0.18 * scale, 12, 56);
    case "icosahedron":
      return new THREE.IcosahedronGeometry(0.92 * scale, 0);
    case "dodecahedron":
      return new THREE.DodecahedronGeometry(0.84 * scale, 0);
    case "sense-stick":
      if (typeof THREE.CapsuleGeometry === "function") {
        return new THREE.CapsuleGeometry(0.14 * scale, 0.92 * scale, 6, 12);
      }

      return new THREE.CylinderGeometry(0.11 * scale, 0.15 * scale, 1.02 * scale, 16);
    default:
      return new THREE.BoxGeometry(0.95 * scale, 0.95 * scale, 0.95 * scale);
  }
};

export const createExperienceScene = async ({
  canvas,
  projects,
  selectedIndex = 0,
  onProjectPreview,
  onProjectLeave,
  onProjectSelect,
  onProjectOpen,
  onReady,
  onQualityChange,
}) => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isCompactViewport = window.matchMedia("(max-width: 820px)").matches;
  const projectLayout = isCompactViewport ? PROJECT_LAYOUTS.compact : PROJECT_LAYOUTS.regular;

  const trackedGeometries = new Set();
  const trackedMaterials = new Set();
  const trackedTextures = new Set();

  const trackGeometry = (geometry) => {
    trackedGeometries.add(geometry);
    return geometry;
  };

  const trackMaterial = (material) => {
    trackedMaterials.add(material);
    return material;
  };

  const trackTexture = (texture) => {
    trackedTextures.add(texture);
    return texture;
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !isCompactViewport,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompactViewport ? 1.4 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = isCompactViewport ? 1.02 : 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x040811, isCompactViewport ? 0.078 : 0.062);

  const camera = new THREE.PerspectiveCamera(isCompactViewport ? 47 : 42, 1, 0.1, 60);
  camera.position.set(0, 0.32, isCompactViewport ? 10.2 : 9.75);

  const cameraRig = new THREE.Group();
  cameraRig.add(camera);
  scene.add(cameraRig);

  const world = new THREE.Group();
  scene.add(world);

  const ambient = new THREE.AmbientLight(0x8aa2bf, 0.48);
  const hemi = new THREE.HemisphereLight(0x88dfff, 0x02050a, 0.74);
  const keyLight = new THREE.SpotLight(0x8cf6ff, isCompactViewport ? 46 : 56, 24, Math.PI / 7, 0.5, 1.2);
  keyLight.position.set(5.8, 8, 7.6);

  const rimLight = new THREE.PointLight(0xff9f8e, isCompactViewport ? 3.4 : 4.4, 16, 2);
  rimLight.position.set(-5.6, 0.4, 4.4);

  const fillLight = new THREE.PointLight(0xbcff66, isCompactViewport ? 1.9 : 2.4, 18, 2);
  fillLight.position.set(0, -2.5, 4.2);

  scene.add(ambient, hemi, keyLight, rimLight, fillLight);

  const glowTexture = trackTexture(await createGlowTexture(THREE));

  const core = new THREE.Group();
  world.add(core);

  const coreShell = new THREE.Mesh(
    trackGeometry(new THREE.IcosahedronGeometry(0.34, 1)),
    trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0xa4fbff,
        emissive: 0x1c3444,
        emissiveIntensity: 0.54,
        roughness: 0.12,
        metalness: 0.24,
        transmission: 0.22,
        transparent: true,
        opacity: 0.82,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      })
    )
  );
  core.add(coreShell);

  const coreWire = new THREE.LineSegments(
    trackGeometry(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.48, 0))),
    trackMaterial(
      new THREE.LineBasicMaterial({
        color: 0x8cf6ff,
        transparent: true,
        opacity: 0.18,
      })
    )
  );
  core.add(coreWire);

  const coreAura = new THREE.Sprite(
    trackMaterial(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x8cf6ff,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
  );
  coreAura.scale.set(2.02, 2.02, 1);
  core.add(coreAura);

  const orbitalRing = new THREE.Mesh(
    trackGeometry(new THREE.TorusGeometry(0.88, 0.022, 16, 88)),
    trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x8cf6ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
      })
    )
  );
  orbitalRing.rotation.x = Math.PI / 2;
  core.add(orbitalRing);

  const outerRing = new THREE.Mesh(
    trackGeometry(new THREE.TorusGeometry(1.38, 0.014, 12, 100)),
    trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xbcff66,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
      })
    )
  );
  outerRing.rotation.set(Math.PI / 2, 0.22, 0);
  world.add(outerRing);

  const floorDisc = new THREE.Mesh(
    trackGeometry(new THREE.RingGeometry(0.94, 2.8, 72)),
    trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x102131,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.16,
      })
    )
  );
  floorDisc.rotation.x = -Math.PI / 2;
  floorDisc.position.y = -1.32;
  world.add(floorDisc);

  const floorHalo = new THREE.Sprite(
    trackMaterial(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x8cf6ff,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
  );
  floorHalo.position.set(0, -1.18, 0);
  floorHalo.scale.set(4.6, 4.6, 1);
  world.add(floorHalo);

  const particleCount = reducedMotion ? 16 : isCompactViewport ? 28 : 40;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleSizes = new Float32Array(particleCount);

  for (let index = 0; index < particleCount; index += 1) {
    const stride = index * 3;
    const radius = 2.2 + Math.random() * 3.6;
    const theta = Math.random() * Math.PI * 2;
    const spread = (Math.random() - 0.5) * 3.1;

    particlePositions[stride] = Math.cos(theta) * radius;
    particlePositions[stride + 1] = spread;
    particlePositions[stride + 2] = Math.sin(theta) * radius * 0.84;
    particleSizes[index] = 0.01 + Math.random() * 0.016;
  }

  const particleGeometry = trackGeometry(new THREE.BufferGeometry());
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("size", new THREE.BufferAttribute(particleSizes, 1));

  const particleMaterial = trackMaterial(
    new THREE.PointsMaterial({
      color: 0xe8f8ff,
      size: isCompactViewport ? 0.024 : 0.02,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );

  const particleField = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particleField);

  const projectNodes = [];
  const raycastTargets = [];

  projects.forEach((project, index) => {
    const node = new THREE.Group();
    const layout = projectLayout[index] ?? {
      position: [0, 0, 0],
      focusYaw: 0,
    };
    const [x, y, z] = layout.position;
    const geometry = trackGeometry(createNodeGeometry(THREE, project));
    const accentColor = new THREE.Color(project.accent);
    const glowColor = new THREE.Color(project.glow);

    node.position.set(x, y, z);

    const mesh = new THREE.Mesh(
      geometry,
      trackMaterial(
        new THREE.MeshPhysicalMaterial({
          color: accentColor,
          emissive: glowColor,
          emissiveIntensity: index === selectedIndex ? 0.95 : 0.28,
          roughness: 0.22,
          metalness: 0.82,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          transparent: true,
          opacity: 0.96,
        })
      )
    );

    mesh.userData.projectIndex = index;
    node.add(mesh);

    const edgeLines = new THREE.LineSegments(
      trackGeometry(new THREE.EdgesGeometry(geometry, 16)),
      trackMaterial(
        new THREE.LineBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: 0.22,
        })
      )
    );
    node.add(edgeLines);

    const aura = new THREE.Sprite(
      trackMaterial(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: glowColor,
          transparent: true,
          opacity: index === selectedIndex ? 0.5 : 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      )
    );
    aura.scale.set(project.scale * 2.1, project.scale * 2.1, 1);
    node.add(aura);

    const orbit = new THREE.Mesh(
      trackGeometry(new THREE.TorusGeometry(project.scale * 1.02, project.scale * 0.01, 8, 48)),
      trackMaterial(
        new THREE.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
        })
      )
    );
    orbit.rotation.y = Math.PI / 2;
    node.add(orbit);

    let sensorHead = null;
    let sensorHalo = null;

    if (project.geometry === "sense-stick") {
      mesh.rotation.z = Math.PI * 0.08;

      sensorHead = new THREE.Mesh(
        trackGeometry(new THREE.SphereGeometry(project.scale * 0.18, 12, 12)),
        trackMaterial(
          new THREE.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            opacity: 0.92,
          })
        )
      );
      sensorHead.position.y = project.scale * 0.68;
      node.add(sensorHead);

      sensorHalo = new THREE.Mesh(
        trackGeometry(new THREE.TorusGeometry(project.scale * 0.34, project.scale * 0.02, 8, 48)),
        trackMaterial(
          new THREE.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
          })
        )
      );
      sensorHalo.position.y = sensorHead.position.y;
      sensorHalo.rotation.x = Math.PI / 2;
      node.add(sensorHalo);
    }

    const shardCluster = new THREE.Group();

    if (project.shards) {
      for (let shardIndex = 0; shardIndex < project.shards; shardIndex += 1) {
        const shard = new THREE.Mesh(
          trackGeometry(new THREE.TetrahedronGeometry(project.scale * 0.18, 0)),
          trackMaterial(
            new THREE.MeshBasicMaterial({
              color: glowColor,
              transparent: true,
              opacity: 0.42,
              blending: THREE.AdditiveBlending,
            })
          )
        );

        const angle = (Math.PI * 2 * shardIndex) / project.shards;
        const radius = project.scale * (0.88 + (shardIndex % 2) * 0.22);
        shard.position.set(
          Math.cos(angle) * radius,
          (shardIndex % 2 === 0 ? 1 : -1) * project.scale * 0.22,
          Math.sin(angle) * radius
        );
        shard.rotation.set(angle * 0.6, angle, angle * 0.35);
        shard.userData = {
          baseY: shard.position.y,
          wobbleOffset: angle,
          spinRate: 0.6 + shardIndex * 0.08,
        };
        shardCluster.add(shard);
      }

      node.add(shardCluster);
    }

    node.userData = {
      index,
      project,
      mesh,
      edgeLines,
      aura,
      orbit,
      sensorHead,
      sensorHalo,
      shardCluster,
      baseY: y,
      floatPhase: Math.random() * Math.PI * 2,
      floatSpeed: 0.62 + index * 0.08,
      spinSpeed: 0.06 + index * 0.015,
    };

    node.scale.setScalar(0);

    world.add(node);
    projectNodes.push(node);
    raycastTargets.push(mesh);
  });

  const motion = {
    hoverIndex: null,
    previewIndex: null,
    selectedIndex,
    focusYaw: projectLayout[selectedIndex]?.focusYaw ?? 0,
    yawOffset: 0.22,
    pitchOffset: 0.06,
    pointerX: 0,
    pointerY: 0,
    dragging: false,
    dragPointerId: null,
    dragDistance: 0,
    lastX: 0,
    lastY: 0,
  };

  const pointer = new THREE.Vector2(5, 5);
  const raycaster = new THREE.Raycaster();
  const targetScale = new THREE.Vector3();
  const clock = new THREE.Clock();
  const loaderElements = {
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
  const entrance = {
    active: false,
  };
  let readyDispatched = false;
  let loaderFrameId = null;

  const qualityLabel = reducedMotion
    ? "Reduced motion / minimal drift"
    : isCompactViewport
      ? "Adaptive render / mobile tuned"
      : "Adaptive render / cinematic depth";

  onQualityChange?.(qualityLabel);

  const signalReady = () => {
    if (readyDispatched) {
      return;
    }

    readyDispatched = true;
    onReady?.(qualityLabel);
  };

  const updateLoaderProgress = (value) => {
    const progress = clamp(Math.round(value), 0, 100);
    const phaseLabel =
      loaderPhases.find((phase) => progress <= phase.threshold)?.label ??
      loaderPhases[loaderPhases.length - 1].label;

    if (loaderElements.phase) {
      loaderElements.phase.textContent = phaseLabel;
    }

    if (loaderElements.percentage) {
      loaderElements.percentage.textContent = `${progress}%`;
    }

    if (loaderElements.track) {
      loaderElements.track.setAttribute("aria-valuenow", String(progress));
    }

    if (loaderElements.fill) {
      loaderElements.fill.style.transform = `scaleX(${progress / 100})`;
    }
  };

  const runLoaderSequence = () => {
    if (
      !loaderElements.container ||
      !loaderElements.phase ||
      !loaderElements.percentage ||
      !loaderElements.track ||
      !loaderElements.fill
    ) {
      entrance.active = true;
      signalReady();
      return;
    }

    const durationMs = reducedMotion ? 1500 : 1850;
    const startTime = performance.now();

    const step = (timestamp) => {
      const elapsedMs = timestamp - startTime;
      const rawProgress = clamp(elapsedMs / durationMs, 0, 1);
      const easedProgress = 1 - Math.pow(1 - rawProgress, 3);

      updateLoaderProgress(easedProgress * 100);

      if (rawProgress < 1) {
        loaderFrameId = window.requestAnimationFrame(step);
        return;
      }

      updateLoaderProgress(100);
      loaderElements.container.classList.add("fade-out");
      entrance.active = true;
      signalReady();
    };

    updateLoaderProgress(0);
    loaderFrameId = window.requestAnimationFrame(step);
  };

  const getHighlightedIndex = () => motion.hoverIndex ?? motion.previewIndex ?? motion.selectedIndex;

  const setHoverIndex = (index) => {
    if (motion.hoverIndex === index) {
      return;
    }

    motion.hoverIndex = index;
    canvas.classList.toggle("is-interactive", index !== null);

    if (index === null) {
      onProjectLeave?.();
      return;
    }

    onProjectPreview?.(index);
  };

  const setSelectedIndex = (index, emit = true) => {
    if (!projects[index]) {
      return;
    }

    motion.selectedIndex = index;
    motion.focusYaw = projectLayout[index]?.focusYaw ?? 0;

    if (emit) {
      onProjectSelect?.(index);
    }
  };

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(canvas);
  window.addEventListener("resize", resize);
  resize();

  const getPointerFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const pickNode = () => {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(raycastTargets, false)[0];
    return hit ? hit.object.userData.projectIndex : null;
  };

  const handlePointerMove = (event) => {
    getPointerFromEvent(event);

    if (motion.dragging && event.pointerId === motion.dragPointerId) {
      const deltaX = event.clientX - motion.lastX;
      const deltaY = event.clientY - motion.lastY;

      motion.lastX = event.clientX;
      motion.lastY = event.clientY;
      motion.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
      motion.yawOffset += deltaX * 0.0048;
      motion.pitchOffset = clamp(motion.pitchOffset + deltaY * 0.0032, -0.35, 0.35);
      return;
    }

    motion.pointerX = pointer.x;
    motion.pointerY = pointer.y;

    if (!supportsFinePointer && event.pointerType !== "mouse") {
      return;
    }

    setHoverIndex(pickNode());
  };

  const handlePointerDown = (event) => {
    motion.dragging = true;
    motion.dragPointerId = event.pointerId;
    motion.dragDistance = 0;
    motion.lastX = event.clientX;
    motion.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event) => {
    if (event.pointerId !== motion.dragPointerId) {
      return;
    }

    motion.dragging = false;
    motion.dragPointerId = null;

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (motion.dragDistance > 8) {
      return;
    }

    getPointerFromEvent(event);
    const hitIndex = pickNode();

    if (hitIndex === null) {
      return;
    }

    setSelectedIndex(hitIndex);
    onProjectOpen?.(hitIndex);
  };

  const handlePointerLeave = () => {
    motion.pointerX = 0;
    motion.pointerY = 0;

    if (!motion.dragging) {
      setHoverIndex(null);
    }
  };

  canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);
  canvas.addEventListener("pointerleave", handlePointerLeave);

  const animate = () => {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;
    const highlightedIndex = getHighlightedIndex();
    const idleDrift = reducedMotion ? 0 : Math.sin(elapsed * 0.18) * 0.06;
    const targetYaw = motion.focusYaw + motion.yawOffset + idleDrift;
    const targetPitch = clamp(
      motion.pitchOffset + (supportsFinePointer ? motion.pointerY * 0.08 : 0),
      -0.35,
      0.35
    );

    world.rotation.y = THREE.MathUtils.lerp(world.rotation.y, targetYaw, 0.05);
    world.rotation.x = THREE.MathUtils.lerp(world.rotation.x, targetPitch, 0.05);

    cameraRig.position.x = THREE.MathUtils.lerp(
      cameraRig.position.x,
      supportsFinePointer ? motion.pointerX * 0.45 : 0,
      0.05
    );
    cameraRig.position.y = THREE.MathUtils.lerp(
      cameraRig.position.y,
      supportsFinePointer ? motion.pointerY * 0.28 : 0,
      0.05
    );
    camera.lookAt(0, 0.05, 0);

    core.rotation.y += delta * (reducedMotion ? 0.06 : 0.18);
    core.rotation.x = Math.sin(elapsed * 0.28) * 0.04;
    orbitalRing.rotation.z += delta * 0.14;
    outerRing.rotation.z -= delta * 0.06;
    particleField.rotation.y += delta * 0.01;

    projectNodes.forEach((node, index) => {
      const emphasis = index === highlightedIndex;
      const {
        mesh,
        edgeLines,
        aura,
        orbit,
        sensorHead,
        sensorHalo,
        shardCluster,
        baseY,
        floatPhase,
        floatSpeed,
        spinSpeed,
      } = node.userData;

      node.position.y = baseY + Math.sin(elapsed * floatSpeed + floatPhase) * (reducedMotion ? 0.02 : 0.06);
      node.rotation.y += delta * spinSpeed;
      node.rotation.x = Math.sin(elapsed * 0.42 + floatPhase) * 0.05;

      mesh.material.emissiveIntensity = THREE.MathUtils.lerp(
        mesh.material.emissiveIntensity,
        emphasis ? 1.1 : 0.28,
        0.08
      );

      edgeLines.material.opacity = THREE.MathUtils.lerp(edgeLines.material.opacity, emphasis ? 0.7 : 0.22, 0.08);
      aura.material.opacity = THREE.MathUtils.lerp(aura.material.opacity, emphasis ? 0.64 : 0.18, 0.08);
      orbit.material.opacity = THREE.MathUtils.lerp(orbit.material.opacity, emphasis ? 0.28 : 0.1, 0.08);
      orbit.rotation.z += delta * (emphasis ? 0.55 : 0.22);

      if (sensorHalo) {
        sensorHalo.material.opacity = THREE.MathUtils.lerp(
          sensorHalo.material.opacity,
          emphasis ? 0.4 : 0.16,
          0.08
        );
        sensorHalo.rotation.z += delta * (emphasis ? 0.9 : 0.38);
      }

      if (sensorHead) {
        sensorHead.material.opacity = THREE.MathUtils.lerp(
          sensorHead.material.opacity,
          emphasis ? 1 : 0.84,
          0.08
        );
      }

      if (shardCluster?.children?.length) {
        shardCluster.rotation.y += delta * (emphasis ? 0.54 : 0.24);
        shardCluster.rotation.x = Math.sin(elapsed * 0.45 + floatPhase) * 0.12;

        shardCluster.children.forEach((shard) => {
          shard.rotation.x += delta * shard.userData.spinRate;
          shard.rotation.y += delta * shard.userData.spinRate * 0.65;
          shard.position.y = shard.userData.baseY + Math.sin(elapsed * 0.9 + shard.userData.wobbleOffset) * 0.05;
        });
      }

      const revealScale = entrance.active ? 1 : 0;
      const emphasisScale = revealScale === 1 && node.scale.x > 0.98 && emphasis ? 1.08 : 1;

      node.scale.lerp(
        targetScale.setScalar(revealScale * emphasisScale),
        entrance.active ? (emphasis ? 0.14 : 0.1) : 0.18
      );
    });

    renderer.render(scene, camera);
  };

  const handleVisibility = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
      return;
    }

    clock.getDelta();
    renderer.setAnimationLoop(animate);
  };

  document.addEventListener("visibilitychange", handleVisibility);

  renderer.setAnimationLoop(animate);
  runLoaderSequence();

  return {
    selectProject(index) {
      setSelectedIndex(index, false);
      motion.previewIndex = null;
    },
    setPreview(index) {
      motion.previewIndex = index;
    },
    clearPreview() {
      motion.previewIndex = null;
    },
    destroy() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();

      if (loaderFrameId !== null) {
        window.cancelAnimationFrame(loaderFrameId);
      }

      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);

      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerLeave);

      trackedGeometries.forEach((geometry) => geometry.dispose());
      trackedMaterials.forEach((material) => material.dispose());
      trackedTextures.forEach((texture) => texture.dispose());

      renderer.dispose();
    },
  };
};
