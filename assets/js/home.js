import { initMaskedHeadings } from "./masked-headings.js";
import {
  animateBatchIn,
  clamp,
  coarsePointer,
  createSmoothScroller,
  gsap,
  reducedMotion,
  ScrollTrigger,
  withScroller,
} from "./motion-system.js";
import { bindCursorMaskReveal } from "./cursor-mask-reveal.js";
import { createPortfolioSound } from "./site-audio.js";
import { createSignalCursor } from "./site-cursor.js";

const root = typeof document !== "undefined" ? document.documentElement : null;
const desktopGatewayQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(min-width: 980px)")
    : { matches: false };
let activeHomeCleanup = null;

/* ─── Utilities ─── */

const smoothstep = (start, end, value) => {
  if (end === start) return value >= end ? 1 : 0;
  const p = clamp((value - start) / (end - start), 0, 1);
  return p * p * (3 - 2 * p);
};

const cursorAttributeNames = [
  "data-cursor-label", "data-cursor-aside", "data-cursor-mode",
  "data-cursor-tone", "data-cursor-reveal",
  "data-cursor-hold-label", "data-cursor-hold-aside",
  "data-cursor-press-label", "data-cursor-press-aside",
  "data-cursor-repeat-label", "data-cursor-repeat-aside",
  "data-magnetic",
];

const sanitizeClone = (node) => {
  node.setAttribute("data-loop-clone", "true");
  node.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  node.querySelectorAll("*").forEach((el) => {
    cursorAttributeNames.forEach((name) => el.removeAttribute(name));
  });
  node.querySelectorAll("a, button, input, textarea, select, summary").forEach((el) => {
    el.setAttribute("tabindex", "-1");
    el.setAttribute("aria-hidden", "true");
  });
  node.setAttribute("aria-hidden", "true");
  node.style.pointerEvents = "none";
  if ("inert" in node) node.inert = true;
};

/* ─── Sound & cursor bindings ─── */

const bindHomepageSoundTargets = (sound) => {
  if (!sound) return;
  const targets = document.querySelectorAll(
    ".chrome-links a, .social-link, .gateway-word, .sound-toggle, .sound-choice, [data-sound-master-toggle], [data-about-reveal]"
  );
  sound.bindHover(targets);
  sound.bindActivate(targets);
};

const bindHomepageCursorTargets = (cursor) => {
  if (!cursor) return;
  cursor.attachToggle?.(document.querySelectorAll("[data-cursor-toggle]"));
  cursor.bindTargets(document.querySelectorAll("[data-cursor-label]"));
};

/* ─── Dynamic favicon ─── */

const createDynamicFavicon = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 32; canvas.height = 32;
  canvas.hidden = true; canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff1f1f";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let icon = document.querySelector("link[rel~='icon']");
  if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.append(icon); }

  const sq = { x: 8, y: 7, vx: 11, vy: 8.5, size: 10, angle: 0 };
  let frameId = 0, lastTime = 0, running = !document.hidden;

  const render = (time) => {
    if (!running) return;
    if (time - lastTime < (reducedMotion ? 100 : 55)) { frameId = requestAnimationFrame(render); return; }
    const dt = lastTime ? (time - lastTime) / 1000 : 0.016;
    lastTime = time;

    sq.x += sq.vx * dt; sq.y += sq.vy * dt;
    if (sq.x <= 3 || sq.x + sq.size >= 29) sq.vx *= -1;
    if (sq.y <= 3 || sq.y + sq.size >= 22) sq.vy *= -1;
    sq.angle += dt * 2.4;

    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 32, 32);

    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(32, 16);
    ctx.moveTo(16, 0); ctx.lineTo(16, 32); ctx.stroke();

    ctx.save();
    ctx.translate(sq.x + sq.size / 2, sq.y + sq.size / 2);
    ctx.rotate(sq.angle);
    ctx.fillStyle = "#f4f1eb";
    ctx.fillRect(-sq.size / 2, -sq.size / 2, sq.size, sq.size);
    ctx.strokeStyle = accent;
    ctx.strokeRect(-sq.size / 2, -sq.size / 2, sq.size, sq.size);
    ctx.restore();

    ctx.fillStyle = "#f4f1eb"; ctx.font = "700 7px Space Grotesk, sans-serif";
    ctx.fillText("JVW", 4, 29);

    icon.href = canvas.toDataURL("image/png");
    frameId = requestAnimationFrame(render);
  };

  const setRunning = (v) => { if (v === running) return; running = v; if (running) { lastTime = 0; frameId = requestAnimationFrame(render); } else cancelAnimationFrame(frameId); };
  const handleVisibilityChange = () => setRunning(!document.hidden);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  frameId = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(frameId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    canvas.remove();
  };
};

/* ─── Scene focus system ─── */

const sceneFocusProfiles = {
  hero:       { currentBias: 0.44, focusSpread: 0.92, focusExponent: 1.22 },
  about:      { currentBias: 0.34, focusSpread: 0.62, focusExponent: 1.62 },
  experience: { currentBias: 0.38, focusSpread: 0.66, focusExponent: 1.5 },
  work:       { currentBias: 0.48, focusSpread: 0.8,  focusExponent: 1.35 },
  motto:      { currentBias: 0.4,  focusSpread: 0.7,  focusExponent: 1.45 },
  contact:    { currentBias: 0.38, focusSpread: 0.66, focusExponent: 1.55 },
  default:    { currentBias: 0.4,  focusSpread: 0.64, focusExponent: 1.5 },
};

const updateSceneStates = (shell, scenes) => {
  const shellRect = shell.getBoundingClientRect();
  const shellCenter = shellRect.top + shell.clientHeight / 2;

  let currentScene = null, highestFocus = -Infinity, nearestDist = Infinity;

  scenes.forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const dist = Math.abs(center - shellCenter);
    const p = sceneFocusProfiles[scene.dataset.sceneId] ?? sceneFocusProfiles.default;
    const focusDist = Math.min(rect.height * p.focusSpread, shell.clientHeight * p.focusSpread);
    const raw = clamp(1 - dist / focusDist, 0, 1);
    const focus = Math.pow(raw, p.focusExponent);
    const isCurrent = dist < Math.min(rect.height * p.currentBias, shell.clientHeight * p.currentBias);

    scene.style.setProperty("--scene-focus", focus.toFixed(4));
    scene.classList.toggle("is-current", isCurrent);

    if (focus > highestFocus || (Math.abs(focus - highestFocus) < 0.001 && dist < nearestDist)) {
      highestFocus = focus; nearestDist = dist; currentScene = scene;
    }
  });

  const curId = currentScene?.id || currentScene?.dataset.sceneId || null;
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const isCur = link.getAttribute("href") === `#${curId}`;
    link.classList.toggle("is-active", isCur);
    link.setAttribute("aria-current", isCur ? "page" : "false");
  });
};

/* ─── Hero entrance ─── */

const setupHeroEntrance = (scope = document) => {
  const title = scope.querySelector("[data-hero-title]");
  const tagline = scope.querySelector("[data-hero-copy]");
  if (!title) return;

  const lines = title.querySelectorAll(".hero-line-inner");
  const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: reducedMotion ? 0 : 0.12 });

  tl.from(lines, { yPercent: 112, opacity: 0, stagger: 0.1, duration: 0.95 });
  if (tagline) tl.from(tagline, { y: 28, opacity: 0, duration: 0.7 }, "-=0.35");
};

/* ─── Hero scene (scroll parallax) ─── */

const setupHeroScene = ({ shell }) => {
  const scene = document.querySelector("[data-loop-source] .scene-hero");
  if (!scene) return null;

  setupHeroEntrance(scene);

  if (reducedMotion) return null;

  const center = scene.querySelector(".hero-name");
  const tagline = scene.querySelector(".hero-tagline");

  if (center) {
    gsap.timeline({
      scrollTrigger: withScroller(shell, { trigger: scene, start: "top top", end: "bottom top", scrub: 0.5 }),
    }).to([center, tagline].filter(Boolean), { yPercent: -6, opacity: 0.3 }, 0);
  }

  return null;
};

/* ─── About scene (skills + humor reveal) ─── */

const setupAboutScene = ({ shell }) => {
  const cleanup = [];

  document.querySelectorAll(".scene-about").forEach((scene) => {
    const header = scene.querySelector(".section-header");
    const items = Array.from(scene.querySelectorAll("[data-skill-item]"));
    const surface = scene.querySelector("[data-about-reveal]");
    const hint = scene.querySelector(".about-hint");

    // Animate skill items in
    animateBatchIn({
      targets: [header, ...items],
      trigger: scene, scroller: shell,
      start: "top 82%", fromY: 32, stagger: 0.08,
    });

    // Cursor mask reveal for the about paragraph
    if (surface && !coarsePointer) {
      const ctrl = bindCursorMaskReveal(surface, { coarsePointer, allowTapLock: true });
      if (ctrl) cleanup.push(() => ctrl.destroy());
    }

    // Animate reveal wrap
    if (surface || hint) {
      animateBatchIn({
        targets: [surface, hint].filter(Boolean),
        trigger: scene, scroller: shell,
        start: "top 68%", fromY: 28, stagger: 0.1,
      });
    }
  });

  return () => cleanup.forEach((d) => d());
};

/* ─── Experience timeline ─── */

const setupExperienceScene = ({ shell }) => {
  document.querySelectorAll(".scene-experience").forEach((scene) => {
    const header = scene.querySelector(".section-header");
    const items = Array.from(scene.querySelectorAll("[data-timeline-item]"));

    animateBatchIn({
      targets: [header, ...items],
      trigger: scene, scroller: shell,
      start: "top 82%", fromY: 30, stagger: 0.1,
    });
  });

  return null;
};

/* ─── Gateway scene (big words with humor + scroll driven) ─── */

const setGatewayWordState = (word, { focus, isActive }) => {
  word.style.setProperty("--gateway-word-focus", focus.toFixed(4));
  word.classList.toggle("is-active", isActive);
};

const updateGatewayWords = (words, progress) => {
  if (!words.length) return 0;

  const phaseSize = 1 / words.length;
  const states = words.map((word, i) => {
    const center = (i + 0.5) * phaseSize;
    const linger = clamp(parseFloat(word.dataset.gatewayWordLinger ?? "1"), 0.75, 2);
    const dist = Math.abs(progress - center);
    const plateau = phaseSize * 0.22 * linger;
    const falloff = phaseSize * 0.68 * linger;
    const raw = dist <= plateau ? 1 : clamp(1 - (dist - plateau) / falloff, 0, 1);
    return { focus: smoothstep(0, 1, raw) };
  });

  const activeIdx = states.reduce((best, s, i) => (s.focus > states[best].focus ? i : best), 0);

  states.forEach((s, i) => {
    setGatewayWordState(words[i], { focus: s.focus, isActive: i === activeIdx });
  });

  return activeIdx;
};

const getGatewayWordTravel = (word) => {
  const speed = parseFloat(word.dataset.gatewayWordSpeed ?? "0.4");
  const mult = desktopGatewayQuery.matches ? 2 : 1;
  return clamp(window.innerHeight * speed * mult, 84, window.innerHeight * 0.68 * mult);
};

const setupGatewayScene = ({ shell }) => {
  const cleanup = [];

  document.querySelectorAll(".scene-gateway").forEach((scene) => {
    const copyTargets = Array.from(scene.querySelectorAll("[data-gateway-fade]"));
    const words = Array.from(scene.querySelectorAll("[data-gateway-word]"));

    if (!words.length) return;

    scene.classList.add("is-staged");
    updateGatewayWords(words, 0);

    // Cursor mask reveal for each gateway word
    words.forEach((word) => {
      const ctrl = bindCursorMaskReveal(word, {
        coarsePointer, allowTapLock: true, lockOnPrimaryAction: true,
        lockToCenter: desktopGatewayQuery.matches,
      });
      if (ctrl) cleanup.push(() => ctrl.destroy());

      if (coarsePointer) return;

      const handleEnter = () => {
        words.forEach((w) => w.classList.toggle("is-dimmed", w !== word));
      };
      const handleMove = (e) => {
        const rect = word.getBoundingClientRect();
        const mx = (e.clientX - (rect.left + rect.width / 2)) * 0.05;
        const my = (e.clientY - (rect.top + rect.height / 2)) * 0.04;
        word.style.setProperty("--gateway-word-move-x", `${mx.toFixed(2)}px`);
        word.style.setProperty("--gateway-word-move-y", `${my.toFixed(2)}px`);
        word.style.setProperty("--gateway-word-scale", "1.018");
      };
      const handleLeave = () => {
        words.forEach((w) => {
          w.classList.remove("is-dimmed");
          w.style.removeProperty("--gateway-word-move-x");
          w.style.removeProperty("--gateway-word-move-y");
          w.style.removeProperty("--gateway-word-scale");
        });
      };

      word.addEventListener("pointerenter", handleEnter);
      word.addEventListener("pointermove", handleMove);
      word.addEventListener("pointerleave", handleLeave);
      cleanup.push(() => {
        word.removeEventListener("pointerenter", handleEnter);
        word.removeEventListener("pointermove", handleMove);
        word.removeEventListener("pointerleave", handleLeave);
      });
    });

    // Entrance animation
    if (!reducedMotion) {
      gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: withScroller(shell, { trigger: scene, start: "top 82%", toggleActions: "play none none none" }),
      }).from(copyTargets, { y: 24, opacity: 0, stagger: 0.08, duration: 0.64, clearProps: "transform,opacity" });

      // Scroll-driven vertical shift on desktop
      if (!coarsePointer) {
        const stackTl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: withScroller(shell, { trigger: scene, start: "top top", end: "bottom bottom", scrub: 0.45, invalidateOnRefresh: true }),
        });

        words.forEach((word) => {
          stackTl.fromTo(word,
            { "--gateway-word-shift": "0px" },
            { "--gateway-word-shift": () => `${-getGatewayWordTravel(word)}px` },
            0
          );
        });
      }
    }

    // Scroll-driven focus
    ScrollTrigger.create({
      trigger: scene,
      ...withScroller(shell, { start: "top top", end: "bottom bottom", scrub: reducedMotion ? false : 0.45 }),
      onRefresh: (self) => updateGatewayWords(words, self.progress),
      onUpdate: (self) => updateGatewayWords(words, self.progress),
    });
  });

  return () => cleanup.forEach((d) => d());
};

/* ─── Motto scene ─── */

const setupMottoScene = ({ shell }) => {
  document.querySelectorAll(".scene-motto").forEach((scene) => {
    const label = scene.querySelector(".motto-label");
    const quote = scene.querySelector(".motto-quote");
    const cite = scene.querySelector(".motto-cite");

    animateBatchIn({
      targets: [label, quote, cite].filter(Boolean),
      trigger: scene, scroller: shell,
      start: "top 80%", fromY: 40, stagger: 0.12,
    });
  });

  return null;
};

/* ─── Contact scene (social reveals) ─── */

const setupContactScene = ({ shell }) => {
  const cleanup = [];

  document.querySelectorAll(".scene-contact").forEach((scene) => {
    const panelItems = Array.from(scene.querySelectorAll(".contact-panel > *"));
    const socialItems = Array.from(scene.querySelectorAll(".social-link"));

    // Social link hover reveals
    socialItems.forEach((link) => {
      if (!link.hasAttribute("data-text-reveal")) return;
      const ctrl = bindCursorMaskReveal(link, { coarsePointer, allowTapLock: true, lockOnPrimaryAction: true });
      if (ctrl) cleanup.push(() => ctrl.destroy());
    });

    // Entrance animation
    animateBatchIn({
      targets: [...panelItems, ...socialItems],
      trigger: scene, scroller: shell,
      start: "top 82%", fromY: 34, fromOpacity: 0.2, stagger: 0.1, ease: "power2.out",
    });
  });

  return () => cleanup.forEach((d) => d());
};

/* ─── Anchor navigation ─── */

const setupAnchorNavigation = ({ lenis, source, getSegmentHeight }) => {
  const listeners = [];

  const scrollToHash = (hash, immediate = false) => {
    if (!hash?.startsWith("#")) return;
    const target = source.querySelector(hash);
    if (!target) return;

    const lead = clamp(window.innerHeight * 0.12, 64, 140);
    const dest = getSegmentHeight() + target.offsetTop - lead;
    lenis.scrollTo(dest, { immediate, duration: reducedMotion ? 0 : 1.05, force: true });
  };

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const handler = (e) => {
      const href = link.getAttribute("href");
      if (!href?.startsWith("#")) return;
      e.preventDefault();
      history.replaceState(null, "", href);
      scrollToHash(href);
    };
    link.addEventListener("click", handler);
    listeners.push(() => link.removeEventListener("click", handler));
  });

  const hashHandler = () => scrollToHash(window.location.hash, false);
  window.addEventListener("hashchange", hashHandler);

  requestAnimationFrame(() => scrollToHash(window.location.hash || "#hero", true));

  return () => { listeners.forEach((d) => d()); window.removeEventListener("hashchange", hashHandler); };
};

/* ─── Infinite homepage loop ─── */

const setupInfiniteHomepage = () => {
  const shell = document.querySelector("[data-loop-shell]");
  const track = document.querySelector("[data-loop-track]");
  const source = document.querySelector("[data-loop-source]");
  if (!shell || !track || !source) return null;

  const beforeClone = source.cloneNode(true);
  const afterClone = source.cloneNode(true);
  sanitizeClone(beforeClone);
  sanitizeClone(afterClone);
  track.prepend(beforeClone);
  track.append(afterClone);

  const loopScenes = Array.from(track.querySelectorAll("[data-scene]"));

  const scroller = createSmoothScroller({
    wrapper: shell, content: track,
    duration: reducedMotion ? 0 : 0.92,
    syncScrollTrigger: true,
  });

  if (!scroller) return null;

  const maskedHeadings = initMaskedHeadings({ root: track, scroller: shell, reducedMotion });

  const { lenis } = scroller;
  let segmentHeight = 0, isResetting = false;

  const setVelocityVars = (v = 0) => {
    const skew = reducedMotion || coarsePointer ? 0 : clamp(v * -0.0018, -0.45, 0.45);
    const shift = reducedMotion || coarsePointer ? 0 : clamp(Math.abs(v) * 0.03, 0, 2.2);
    root.style.setProperty("--scroll-skew", `${skew.toFixed(2)}deg`);
    root.style.setProperty("--velocity-shift", `${shift.toFixed(2)}px`);
  };

  const measure = () => {
    segmentHeight = source.offsetHeight;
    if (!segmentHeight) return;
    if (shell.scrollTop === 0) lenis.scrollTo(segmentHeight, { immediate: true, force: true });
    updateSceneStates(shell, loopScenes);
  };

  lenis.on("scroll", (e) => {
    if (!segmentHeight) return;
    setVelocityVars(e.velocity ?? 0);
    updateSceneStates(shell, loopScenes);

    if (isResetting) return;
    const st = shell.scrollTop;
    const buf = Math.max(6, Math.min(window.innerHeight * 0.015, segmentHeight * 0.006));
    const srcStart = segmentHeight;
    const srcEnd = segmentHeight * 2;

    if (st < srcStart - buf) {
      isResetting = true;
      lenis.scrollTo(st + segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => { isResetting = false; ScrollTrigger.update(); updateSceneStates(shell, loopScenes); });
    } else if (st > srcEnd + buf) {
      isResetting = true;
      lenis.scrollTo(st - segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => { isResetting = false; ScrollTrigger.update(); updateSceneStates(shell, loopScenes); });
    }
  });

  const cleanup = [
    setupHeroScene({ shell }),
    setupAboutScene({ shell }),
    setupExperienceScene({ shell }),
    setupGatewayScene({ shell }),
    setupMottoScene({ shell }),
    setupContactScene({ shell }),
    setupAnchorNavigation({ lenis, source, getSegmentHeight: () => segmentHeight }),
  ].filter(Boolean);

  const handleResize = () => { measure(); ScrollTrigger.refresh(); };
  window.addEventListener("resize", handleResize);
  ScrollTrigger.addEventListener("refresh", measure);
  measure();
  ScrollTrigger.refresh();

  return {
    destroy() {
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.removeEventListener("refresh", measure);
      scroller.destroy();
      maskedHeadings.destroy();
      cleanup.forEach((d) => d?.());
      ScrollTrigger.getAll().forEach((t) => { if (t.scroller === shell) t.kill(); });
      beforeClone.remove(); afterClone.remove();
      root.style.removeProperty("--scroll-skew");
      root.style.removeProperty("--velocity-shift");
    },
  };
};

/* ─── Boot ─── */

export const initHomePage = () => {
  activeHomeCleanup?.();

  const destroyFavicon = createDynamicFavicon();

  const sound = createPortfolioSound({
    menuRoot: document.querySelector("[data-sound-menu]"),
    autoLoopCues: ["mainAmbient"],
  });

  const cursor = createSignalCursor({
    defaultLabel: "Drift Gently",
    defaultAside: "the lake is calm. your tabs are not.",
    defaultMode: "default",
  });

  bindHomepageSoundTargets(sound);
  bindHomepageCursorTargets(cursor);

  const homepage = setupInfiniteHomepage();

  const destroy = () => {
    homepage?.destroy();
    cursor?.destroy();
    sound?.destroy();
    destroyFavicon?.();

    if (activeHomeCleanup === destroy) {
      activeHomeCleanup = null;
    }
  };

  activeHomeCleanup = destroy;
  return destroy;
};
