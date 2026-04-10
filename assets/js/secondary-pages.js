import { initMaskedHeadings } from "./masked-headings.js";
import {
  animateBatchIn,
  clamp,
  createSmoothScroller,
  gsap,
  reducedMotion,
  ScrollTrigger,
  withScroller,
} from "./motion-system.js";
import { createSignalCursor } from "./site-cursor.js";

const root = document.documentElement;

const cursorAttributeNames = [
  "data-cursor-label",
  "data-cursor-aside",
  "data-cursor-mode",
  "data-cursor-tone",
  "data-cursor-reveal",
  "data-cursor-hold-label",
  "data-cursor-hold-aside",
  "data-cursor-press-label",
  "data-cursor-press-aside",
  "data-cursor-repeat-label",
  "data-cursor-repeat-aside",
  "data-magnetic",
];

const sanitizeClone = (node) => {
  node.querySelectorAll("[id]").forEach((element) => {
    element.removeAttribute("id");
  });

  node.querySelectorAll("*").forEach((element) => {
    cursorAttributeNames.forEach((name) => {
      element.removeAttribute(name);
    });
  });

  node.querySelectorAll("a, button, input, textarea, select, summary").forEach((element) => {
    element.setAttribute("tabindex", "-1");
    element.setAttribute("aria-hidden", "true");
  });

  node.setAttribute("aria-hidden", "true");
  node.style.pointerEvents = "none";

  if ("inert" in node) {
    node.inert = true;
  }
};

const syncChromeHeight = () => {
  const chrome = document.querySelector(".secondary-chrome");

  if (!chrome) {
    return 0;
  }

  const height = Math.ceil(chrome.getBoundingClientRect().height);
  root.style.setProperty("--secondary-chrome-height", `${height}px`);
  return height;
};

const updateSceneStates = (shell, scenes) => {
  const shellRect = shell.getBoundingClientRect();
  const shellCenter = shellRect.top + shell.clientHeight / 2;

  scenes.forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    const sceneCenter = rect.top + rect.height / 2;
    const distance = Math.abs(sceneCenter - shellCenter);
    const focusDistance = Math.min(rect.height * 0.72, shell.clientHeight * 0.72);
    const rawFocus = clamp(1 - distance / focusDistance, 0, 1);
    const focus = Math.pow(rawFocus, 1.45);
    const isCurrent = distance < Math.min(rect.height * 0.34, shell.clientHeight * 0.34);

    scene.style.setProperty("--scene-focus", focus.toFixed(4));
    scene.classList.toggle("is-current", isCurrent);
  });
};

const setupHeaderEntrance = () => {
  const copy = document.querySelectorAll(".secondary-header-copy > *");
  const tools = document.querySelectorAll(".secondary-header-tools > *");

  gsap.from(copy, {
    y: reducedMotion ? 0 : 18,
    opacity: reducedMotion ? 1 : 0,
    duration: 0.72,
    stagger: 0.08,
    ease: "power3.out",
  });

  gsap.from(tools, {
    y: reducedMotion ? 0 : 14,
    opacity: reducedMotion ? 1 : 0,
    duration: 0.62,
    stagger: 0.05,
    ease: "power3.out",
    delay: reducedMotion ? 0 : 0.08,
  });
};

const setupSceneAnimations = ({ shell, scenes }) => {
  scenes.forEach((scene) => {
    const targets = scene.querySelectorAll(
      ".scene-meta, .secondary-scene-title, .secondary-scene-support, .secondary-scene-note, .phase-grid, .single-slab-row, .degree-details, .gateway-link"
    );

    animateBatchIn({
      targets,
      trigger: scene,
      scroller: shell,
      start: "top 84%",
      fromY: 36,
      stagger: 0.07,
    });

    if (reducedMotion) {
      return;
    }

    const slabs = scene.querySelectorAll("[data-scroll-slab]");

    gsap.from(scene.querySelectorAll(".secondary-slab, .degree-word"), {
      opacity: 0,
      duration: 0.72,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: withScroller(shell, {
        trigger: scene,
        start: "top 84%",
        toggleActions: "play none none none",
      }),
    });

    slabs.forEach((slab) => {
      gsap.fromTo(
        slab,
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: "none",
          scrollTrigger: withScroller(shell, {
            trigger: scene,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.4,
          }),
        }
      );
    });
  });
};

const initLoopShell = (shell) => {
  const track = shell.querySelector("[data-loop-track]");
  const source = shell.querySelector("[data-loop-source]");

  if (!track || !source) {
    return null;
  }

  syncChromeHeight();

  const maskedHeadings = initMaskedHeadings({
    root: source,
    scroller: shell,
    reducedMotion,
  });

  const beforeClone = source.cloneNode(true);
  const afterClone = source.cloneNode(true);

  sanitizeClone(beforeClone);
  sanitizeClone(afterClone);

  beforeClone.dataset.loopClone = "before";
  afterClone.dataset.loopClone = "after";

  track.prepend(beforeClone);
  track.append(afterClone);

  const scenes = Array.from(track.querySelectorAll("[data-scene]")).filter(Boolean);
  const motionTargets = Array.from(track.querySelectorAll("[data-scroll-slab]")).filter(Boolean);
  const scroller = createSmoothScroller({
    wrapper: shell,
    content: track,
    duration: reducedMotion ? 0 : 0.96,
    syncScrollTrigger: true,
  });

  if (!scroller) {
    return null;
  }

  const { lenis } = scroller;
  let segmentHeight = 0;
  let isResetting = false;

  const applyMotion = (velocity = 0) => {
    const skew = reducedMotion ? 0 : clamp(velocity * -0.0018, -0.45, 0.45);
    const shift = reducedMotion ? 0 : clamp(Math.abs(velocity) * 0.03, 0, 2.2);

    root.style.setProperty("--scroll-skew", `${skew.toFixed(2)}deg`);
    root.style.setProperty("--velocity-shift", `${shift.toFixed(2)}px`);

    motionTargets.forEach((element) => {
      element.style.setProperty("--dynamic-skew", `${skew.toFixed(2)}deg`);
      element.style.setProperty("--dynamic-shift", `${shift.toFixed(2)}px`);
    });
  };

  const measure = () => {
    syncChromeHeight();
    segmentHeight = source.offsetHeight;

    if (!segmentHeight) {
      return;
    }

    if (shell.scrollTop === 0) {
      lenis.scrollTo(segmentHeight, { immediate: true, force: true });
    }

    updateSceneStates(shell, scenes);
  };

  lenis.on("scroll", (event) => {
    if (!segmentHeight) {
      return;
    }

    applyMotion(event.velocity ?? 0);
    updateSceneStates(shell, scenes);

    if (isResetting) {
      return;
    }

    const currentScrollTop = shell.scrollTop;
    const wrapBuffer = Math.max(6, Math.min(window.innerHeight * 0.015, segmentHeight * 0.006));
    const sourceStart = segmentHeight;
    const sourceEnd = segmentHeight * 2;

    if (currentScrollTop < sourceStart - wrapBuffer) {
      isResetting = true;
      lenis.scrollTo(currentScrollTop + segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => {
        isResetting = false;
        ScrollTrigger.update();
        updateSceneStates(shell, scenes);
      });
    } else if (currentScrollTop > sourceEnd + wrapBuffer) {
      isResetting = true;
      lenis.scrollTo(currentScrollTop - segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => {
        isResetting = false;
        ScrollTrigger.update();
        updateSceneStates(shell, scenes);
      });
    }
  });

  setupSceneAnimations({ shell, scenes });

  const handleResize = () => {
    measure();
    ScrollTrigger.refresh();
  };

  window.addEventListener("resize", handleResize);
  ScrollTrigger.addEventListener("refresh", measure);

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      measure();
      ScrollTrigger.refresh();
    }).catch(() => {});
  }

  measure();
  ScrollTrigger.refresh();

  return {
    destroy() {
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.removeEventListener("refresh", measure);
      scroller.destroy();
      maskedHeadings.destroy();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.scroller === shell) {
          trigger.kill();
        }
      });
      beforeClone.remove();
      afterClone.remove();
      root.style.removeProperty("--scroll-skew");
      root.style.removeProperty("--velocity-shift");
      motionTargets.forEach((element) => {
        element.style.removeProperty("--dynamic-skew");
        element.style.removeProperty("--dynamic-shift");
      });
    },
  };
};

const initSecondaryPage = () => {
  const loops = Array.from(document.querySelectorAll("[data-loop-shell]"))
    .map((shell) => initLoopShell(shell))
    .filter(Boolean);

  syncChromeHeight();
  setupHeaderEntrance();

  const cursor = createSignalCursor({
    defaultLabel: "Route Cursor",
    defaultAside: "cleaner page, same sharp opinions",
  });

  cursor.attachToggle(document.querySelectorAll("[data-cursor-toggle]"));
  cursor.bindTargets(document.querySelectorAll("[data-cursor-label]"));

  window.addEventListener(
    "pagehide",
    () => {
      loops.forEach((loop) => loop?.destroy());
      cursor?.destroy();
    },
    { once: true }
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSecondaryPage, { once: true });
} else {
  initSecondaryPage();
}
