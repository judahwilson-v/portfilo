/* ═══════════════════════════════════════════════════════════════
   EXPERIENCE.JS — Controller
   Wires scroll → Three.js camera via GSAP ScrollTrigger
   Manages overlay, section visibility, project data hydration
   ═══════════════════════════════════════════════════════════════ */

import { gsap, ScrollTrigger, reducedMotion } from "../assets/js/motion-system.js";
import { createPortfolioSound } from "../assets/js/site-audio.js";
import { createSignalCursor } from "../assets/js/site-cursor.js";
import { PROJECTS } from "./projects.js";

const state = {
  scene: null,
  sound: null,
  cursor: null,
  overlayActive: false,
  currentFocus: -1,
  overlayHideTimeout: 0,
};

let activeExperienceCleanup = null;

/* ─── DOM references ─── */
const getElements = () => ({
  canvas: document.getElementById("exp-canvas"),
  scrollContainer: document.getElementById("exp-scroll-container"),
  sections: document.querySelectorAll("[data-exp-section]"),
  projectSections: document.querySelectorAll('[data-exp-section="project"]'),
  overlay: document.getElementById("exp-overlay"),
  overlayClose: document.getElementById("exp-overlay-close"),
  overlayIndex: document.getElementById("exp-overlay-index"),
  overlayCategory: document.getElementById("exp-overlay-category"),
  overlayTitle: document.getElementById("exp-overlay-title"),
  overlayBlurb: document.getElementById("exp-overlay-blurb"),
  overlayLaunch: document.getElementById("exp-overlay-launch"),
  overlayCTA: document.getElementById("exp-overlay-cta-text"),
  hudStatus: document.getElementById("exp-hud-status"),
  fallback: document.getElementById("experience-fallback"),
  fallbackLinks: document.getElementById("fallback-links"),
  loaderUI: document.getElementById("loader-ui"),
});

let elements;

const initExperienceDiagnostics = () => {
  const diagnosticsPanel = document.getElementById("experience-diagnostics");
  const diagnosticsOutput = document.getElementById("experience-diagnostic-output");
  const diagnosticsSummary = document.getElementById("experience-diagnostics-summary");

  const setSummary = (message) => {
    if (diagnosticsSummary) diagnosticsSummary.textContent = message;
  };

  const showDiagnostics = () => {
    if (diagnosticsPanel) diagnosticsPanel.hidden = false;
  };

  const appendDiagnostic = (message, level = "info") => {
    if (!diagnosticsOutput) return;
    if (diagnosticsOutput.dataset.empty === "true") {
      diagnosticsOutput.textContent = "";
      diagnosticsOutput.dataset.empty = "false";
    }
    const line = document.createElement("div");
    line.className = `diagnostic-line diagnostic-line-${level}`;
    line.textContent = message;
    diagnosticsOutput.append(line);
    if (level === "error" || level === "warn") showDiagnostics();
  };

  const formatErrorDetail = (value) => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  setSummary("Watching module delivery and runtime failures.");
  appendDiagnostic("1. HTML Parsed successfully.", "ok");
  appendDiagnostic(
    `ES module support detected: ${"noModule" in document.createElement("script")}.`,
    "info"
  );
  appendDiagnostic("Bundled module delivery active.", "info");
  appendDiagnostic(
    `window.WebGLRenderingContext present: ${Boolean(window.WebGLRenderingContext)}.`,
    window.WebGLRenderingContext ? "info" : "error"
  );

  window.__experienceDiagnostics = {
    push(message, level = "info") {
      appendDiagnostic(message, level);
    },
  };

  window.__experienceModuleReached = true;
  appendDiagnostic("experience.js executed and reached module entry.", "ok");

  const previousOnError = window.onerror;
  const previousOnUnhandledRejection = window.onunhandledrejection;

  const handleWindowError = (event) => {
    if (event.target && event.target !== window) {
      const target = event.target;
      const resourceUrl = target.currentSrc || target.src || target.href || "(inline resource)";
      const tagName = target.tagName ? target.tagName.toLowerCase() : "resource";
      appendDiagnostic(`Resource load error on <${tagName}>: ${resourceUrl}`, "error");
    }
  };

  const handleOnError = (message, source, lineno, colno, error) => {
    const detail = error ? formatErrorDetail(error) : String(message);
    const location = source ? ` @ ${source}:${lineno || 0}:${colno || 0}` : "";
    appendDiagnostic(`window.onerror: ${detail}${location}`, "error");
    return false;
  };

  const handleUnhandledRejection = (event) => {
    appendDiagnostic(`window.onunhandledrejection: ${formatErrorDetail(event.reason)}`, "error");
  };

  window.addEventListener("error", handleWindowError, true);
  window.onerror = handleOnError;
  window.onunhandledrejection = handleUnhandledRejection;

  return () => {
    delete window.__experienceDiagnostics;
    delete window.__experienceModuleReached;
    window.removeEventListener("error", handleWindowError, true);
    if (window.onerror === handleOnError) {
      window.onerror = previousOnError;
    }
    if (window.onunhandledrejection === handleUnhandledRejection) {
      window.onunhandledrejection = previousOnUnhandledRejection;
    }
  };
};

/* ─── Hydrate project data into HTML sections ─── */
const hydrateProjectSections = () => {
  elements.projectSections.forEach((section) => {
    const idx = Number(section.dataset.projectIndex);
    const project = PROJECTS[idx];
    if (!project) return;

    const info = section.querySelector(".exp-project-info");
    if (!info) return;

    const index = info.querySelector(".exp-project-index");
    const title = info.querySelector(".exp-project-title");
    const category = info.querySelector(".exp-project-category");
    const blurb = info.querySelector(".exp-project-blurb");
    const cta = info.querySelector(".exp-project-cta");

    if (index && index.textContent !== project.index) index.textContent = project.index;
    if (title && title.textContent !== project.title) title.textContent = project.title;
    if (category && category.textContent !== project.category) category.textContent = project.category;
    if (blurb && blurb.textContent !== project.blurb) blurb.textContent = project.blurb;
    if (cta) {
      if (cta.href !== project.url) {
        cta.href = project.url;
      }
      const ctaText = cta.querySelector(".exp-cta-text");
      const nextLabel = project.ctaLabel ?? "Launch live site";
      if (ctaText && ctaText.textContent !== nextLabel) {
        ctaText.textContent = nextLabel;
      }
    }
  });
};

/* ─── Overlay ─── */
const showOverlay = (index) => {
  const project = PROJECTS[index];
  if (!project || !elements.overlay) return;

  if (state.overlayHideTimeout) {
    clearTimeout(state.overlayHideTimeout);
    state.overlayHideTimeout = 0;
  }

  state.overlayActive = true;

  elements.overlayIndex.textContent = project.index;
  elements.overlayCategory.textContent = project.category;
  elements.overlayTitle.textContent = project.title;
  elements.overlayBlurb.textContent = project.blurb;
  elements.overlayLaunch.href = project.url;
  if (elements.overlayCTA) {
    elements.overlayCTA.textContent = project.ctaLabel ?? "Launch live site";
  }

  elements.overlay.hidden = false;
  // Force reflow before adding class
  void elements.overlay.offsetHeight;
  elements.overlay.classList.add("is-active");

  state.sound?.play("uiConfirm", { cooldownMs: 200 });
};

const hideOverlay = () => {
  if (!elements.overlay) return;
  state.overlayActive = false;
  elements.overlay.classList.remove("is-active");
  if (state.overlayHideTimeout) {
    clearTimeout(state.overlayHideTimeout);
  }
  state.overlayHideTimeout = window.setTimeout(() => {
    if (!state.overlayActive) {
      elements.overlay.hidden = true;
    }
    state.overlayHideTimeout = 0;
  }, 420);
};

/* ─── Scroll → Camera Sync (the core link) ─── */
const setupScrollCamera = () => {
  const container = elements.scrollContainer;
  if (!container) return () => {};

  // This ScrollTrigger watches the entire scroll container
  // and maps scroll progress 0→1 to camera position
  const trigger = ScrollTrigger.create({
    trigger: container,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.8,
    onUpdate: (self) => {
      if (state.scene) {
        state.scene.setScrollProgress(self.progress);
      }
    },
  });

  return () => trigger.kill();
};

/* ─── Section Content Visibility ─── */
const setupScrollVisibility = () => {
  const cleanups = [];

  elements.projectSections.forEach((section) => {
    const content = section.querySelector(".exp-section-content");
    if (!content) return;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 70%",
      end: "bottom 30%",
      onEnter: () => content.classList.add("is-visible"),
      onLeave: () => content.classList.remove("is-visible"),
      onEnterBack: () => content.classList.add("is-visible"),
      onLeaveBack: () => content.classList.remove("is-visible"),
    });
    cleanups.push(() => trigger.kill());
  });

  // Exit section
  const exitSection = document.querySelector('[data-exp-section="exit"]');
  if (exitSection) {
    const exitContent = exitSection.querySelector(".exp-section-content");
    if (exitContent) {
      const trigger = ScrollTrigger.create({
        trigger: exitSection,
        start: "top 70%",
        end: "bottom 30%",
        onEnter: () => exitContent.classList.add("is-visible"),
        onLeave: () => exitContent.classList.remove("is-visible"),
        onEnterBack: () => exitContent.classList.add("is-visible"),
        onLeaveBack: () => exitContent.classList.remove("is-visible"),
      });
      cleanups.push(() => trigger.kill());
    }
  }

  return () => cleanups.forEach((cleanup) => cleanup());
};

/* ─── Entrance animation ─── */
const animateEntrance = () => {
  if (reducedMotion) return;

  gsap.from(".exp-header > *", {
    y: 14,
    opacity: 0,
    duration: 0.7,
    stagger: 0.08,
    ease: "power3.out",
    clearProps: "transform,opacity",
  });

  const entryContent = document.querySelector('.exp-section-entry .exp-section-content');
  if (entryContent) {
    gsap.from(entryContent.children, {
      y: 30,
      opacity: 0,
      duration: 0.9,
      stagger: 0.1,
      ease: "power3.out",
      delay: 0.2,
      clearProps: "transform,opacity",
    });
  }

  gsap.from(".exp-hud", {
    opacity: 0,
    duration: 1.2,
    delay: 0.5,
    ease: "power2.out",
    clearProps: "opacity",
  });
};

/* ─── Fallback ─── */
const renderFallbackLinks = () => {
  if (!elements.fallbackLinks) return;
  elements.fallbackLinks.innerHTML = PROJECTS.map(
    (p) => `<a href="${p.url}" target="_blank" rel="noreferrer"
      data-cursor-label="Open" data-cursor-aside="${p.title}"
    >${p.title}</a>`
  ).join("");

  const links = elements.fallbackLinks.querySelectorAll("a");
  state.sound?.bindHover(links);
  state.sound?.bindActivate(links);
  state.cursor?.bindTargets(links);
};

const showFallback = (error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error("Experience scene fallback:", reason);
  window.__experienceDiagnostics?.push(`Scene fallback: ${reason}`, "error");

  document.body.classList.add("scene-failed", "is-ready");
  elements?.loaderUI?.setAttribute("hidden", "hidden");

  if (elements?.fallback) elements.fallback.hidden = false;
  if (elements?.hudStatus) elements.hudStatus.textContent = "Fallback links ready";
};

/* ─── Boot Scene ─── */
const bootScene = async () => {
  try {
    window.__experienceDiagnostics?.push("Importing scene.js...", "info");

    const { createExperienceScene, getWebGLSupport } = await import("./scene.js");
    const webgl = getWebGLSupport();

    if (!webgl.supported) throw new Error(webgl.reason);

    window.__experienceDiagnostics?.push(`WebGL: ${webgl.contextType}`, "ok");

    state.scene = await createExperienceScene({
      canvas: elements.canvas,
      projects: PROJECTS,
      onNodeHover: (index) => {
        state.sound?.play("nodePing", { cooldownMs: 140 });
        state.cursor?.setOverrideMessage({
          label: PROJECTS[index]?.title ?? "Project",
          aside: "Click to explore this project.",
          tone: "project",
        });
      },
      onNodeLeave: () => {
        state.cursor?.clearOverrideMessage();
      },
      onNodeClick: (index) => {
        showOverlay(index);
      },
      onReady: (label) => {
        if (elements.hudStatus) elements.hudStatus.textContent = label;
        document.body.classList.add("is-ready");
        window.__experienceDiagnostics?.push("Scene mounted successfully.", "ok");
      },
      onQualityChange: (label) => {
        if (elements.hudStatus) elements.hudStatus.textContent = label;
      },
    });

    // Now that scene is ready, setup scroll → camera sync
    const destroyScrollCamera = setupScrollCamera();
    // Refresh ScrollTrigger since sections + scene are both ready
    ScrollTrigger.refresh();

    return destroyScrollCamera;

  } catch (error) {
    showFallback(error);
    return () => {};
  }
};

/* ─── Init ─── */
export const initExperiencePage = () => {
  activeExperienceCleanup?.();

  const destroyDiagnostics = initExperienceDiagnostics();
  elements = getElements();
  let destroyed = false;
  let bootSceneCleanup = () => {};
  let cancelBootSchedule = () => {};

  // Sound
  state.sound = createPortfolioSound({
    menuRoot: document.querySelector("[data-sound-menu]"),
    autoLoopCues: ["sceneAmbient"],
  });

  // Cursor
  state.cursor = createSignalCursor({
    defaultLabel: "Navigate",
    defaultAside: "Scroll to move through the field.",
  });

  if (!elements.canvas) {
    showFallback(new Error("Canvas element not found."));
    return;
  }

  window.__experienceDiagnostics?.push("DOM elements located.", "ok");

  // Hydrate project data into sections
  hydrateProjectSections();

  // Overlay close
  const handleOverlayClose = () => {
    hideOverlay();
    state.sound?.play("uiConfirm", { cooldownMs: 200 });
  };

  // Close overlay on backdrop click
  const handleOverlayBackdropClick = (e) => {
    if (e.target === elements.overlay) hideOverlay();
  };

  // Close overlay with Escape
  const handleKeydown = (e) => {
    if (e.key === "Escape" && state.overlayActive) hideOverlay();
  };

  elements.overlayClose?.addEventListener("click", handleOverlayClose);
  elements.overlay?.addEventListener("click", handleOverlayBackdropClick);
  document.addEventListener("keydown", handleKeydown);

  // Setup section visibility triggers
  const destroyScrollVisibility = setupScrollVisibility();

  // Bind sound/cursor to interactive elements
  const interactiveEls = document.querySelectorAll(
    ".exp-back, .exp-toggle-btn, .exp-sound-choice, .exp-project-cta, .exp-exit-cta, .exp-overlay-close, .exp-overlay-launch, [data-cursor-toggle]"
  );
  state.sound?.bindHover(interactiveEls);
  state.sound?.bindActivate(interactiveEls);
  state.cursor?.attachToggle(document.querySelectorAll("[data-cursor-toggle]"));
  state.cursor?.bindTargets(document.querySelectorAll("[data-cursor-label], [data-cursor-toggle]"));

  // Fallback links
  renderFallbackLinks();

  // Entrance
  if (reducedMotion) {
    if (elements.hudStatus) elements.hudStatus.textContent = "Reduced motion enabled";
  }
  animateEntrance();

  // Boot 3D (scroll sync happens after scene is ready)
  const startBoot = async () => {
    if (destroyed) {
      return;
    }

    const destroyScrollCamera = await bootScene();

    if (destroyed) {
      destroyScrollCamera?.();
      return;
    }

    bootSceneCleanup = destroyScrollCamera ?? (() => {});
  };

  if ("requestIdleCallback" in window) {
    const idleId = requestIdleCallback(() => {
      startBoot();
    }, { timeout: 1000 });
    cancelBootSchedule = () => cancelIdleCallback(idleId);
  } else {
    const timeoutId = window.setTimeout(startBoot, 120);
    cancelBootSchedule = () => window.clearTimeout(timeoutId);
  }

  const destroy = () => {
    destroyed = true;
    cancelBootSchedule();
    elements.overlayClose?.removeEventListener("click", handleOverlayClose);
    elements.overlay?.removeEventListener("click", handleOverlayBackdropClick);
    document.removeEventListener("keydown", handleKeydown);
    destroyScrollVisibility();
    bootSceneCleanup();
    if (state.overlayHideTimeout) {
      clearTimeout(state.overlayHideTimeout);
      state.overlayHideTimeout = 0;
    }
    state.scene?.destroy();
    state.scene = null;
    state.sound?.destroy();
    state.sound = null;
    state.cursor?.destroy();
    state.cursor = null;
    destroyDiagnostics?.();

    if (activeExperienceCleanup === destroy) {
      activeExperienceCleanup = null;
    }
  };

  activeExperienceCleanup = destroy;
  return destroy;
};
