/* ═══════════════════════════════════════════════════════════════
   EXPERIENCE.JS — Controller
   Wires scroll → Three.js camera via GSAP ScrollTrigger
   Manages overlay, section visibility, project data hydration
   ═══════════════════════════════════════════════════════════════ */

import { gsap, ScrollTrigger, reducedMotion } from "../assets/js/motion-system.js";
import { createPortfolioSound } from "../assets/js/site-audio.js";
import { createSignalCursor } from "../assets/js/site-cursor.js";
import { PROJECTS } from "./projects.js";

window.__experienceModuleReached = true;
window.dispatchEvent(new CustomEvent("experience:module-entered"));

const state = {
  scene: null,
  sound: null,
  cursor: null,
  overlayActive: false,
  currentFocus: -1,
};

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

    if (index) index.textContent = project.index;
    if (title) title.textContent = project.title;
    if (category) category.textContent = project.category;
    if (blurb) blurb.textContent = project.blurb;
    if (cta) {
      cta.href = project.url;
      const ctaText = cta.querySelector(".exp-cta-text");
      if (ctaText) ctaText.textContent = project.ctaLabel ?? "Launch live site";
    }
  });
};

/* ─── Overlay ─── */
const showOverlay = (index) => {
  const project = PROJECTS[index];
  if (!project || !elements.overlay) return;

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
  setTimeout(() => {
    if (!state.overlayActive) {
      elements.overlay.hidden = true;
    }
  }, 420);
};

/* ─── Scroll → Camera Sync (the core link) ─── */
const setupScrollCamera = () => {
  const container = elements.scrollContainer;
  if (!container) return;

  // This ScrollTrigger watches the entire scroll container
  // and maps scroll progress 0→1 to camera position
  ScrollTrigger.create({
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
};

/* ─── Section Content Visibility ─── */
const setupScrollVisibility = () => {
  elements.projectSections.forEach((section) => {
    const content = section.querySelector(".exp-section-content");
    if (!content) return;

    ScrollTrigger.create({
      trigger: section,
      start: "top 70%",
      end: "bottom 30%",
      onEnter: () => content.classList.add("is-visible"),
      onLeave: () => content.classList.remove("is-visible"),
      onEnterBack: () => content.classList.add("is-visible"),
      onLeaveBack: () => content.classList.remove("is-visible"),
    });
  });

  // Exit section
  const exitSection = document.querySelector('[data-exp-section="exit"]');
  if (exitSection) {
    const exitContent = exitSection.querySelector(".exp-section-content");
    if (exitContent) {
      ScrollTrigger.create({
        trigger: exitSection,
        start: "top 70%",
        end: "bottom 30%",
        onEnter: () => exitContent.classList.add("is-visible"),
        onLeave: () => exitContent.classList.remove("is-visible"),
        onEnterBack: () => exitContent.classList.add("is-visible"),
        onLeaveBack: () => exitContent.classList.remove("is-visible"),
      });
    }
  }
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
    setupScrollCamera();
    // Refresh ScrollTrigger since sections + scene are both ready
    ScrollTrigger.refresh();

  } catch (error) {
    showFallback(error);
  }
};

/* ─── Init ─── */
const initExperience = () => {
  elements = getElements();

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
  elements.overlayClose?.addEventListener("click", () => {
    hideOverlay();
    state.sound?.play("uiConfirm", { cooldownMs: 200 });
  });

  // Close overlay on backdrop click
  elements.overlay?.addEventListener("click", (e) => {
    if (e.target === elements.overlay) hideOverlay();
  });

  // Close overlay with Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.overlayActive) hideOverlay();
  });

  // Setup section visibility triggers
  setupScrollVisibility();

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
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => bootScene(), { timeout: 1000 });
  } else {
    setTimeout(bootScene, 120);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initExperience, { once: true });
} else {
  initExperience();
}

window.addEventListener("pagehide", () => {
  state.scene?.destroy();
  state.sound?.destroy();
  state.cursor?.destroy();
});
