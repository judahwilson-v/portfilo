import { initMaskedHeadings } from "./masked-headings.js";
import { createSignalCursor } from "./site-cursor.js";

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

  let segmentHeight = 0;
  let isResetting = false;
  let lastScrollTop = 0;
  let lastTimestamp = performance.now();
  let velocity = 0;
  let frameId = 0;

  const applyMotion = () => {
    velocity *= 0.88;

    const skew = reducedMotion ? 0 : clamp(velocity * -0.05, -8, 8);
    const shift = reducedMotion ? 0 : clamp(Math.abs(velocity) * 2.2, 0, 24);

    root.style.setProperty("--scroll-skew", `${skew.toFixed(2)}deg`);
    root.style.setProperty("--velocity-shift", `${shift.toFixed(2)}px`);

    motionTargets.forEach((element) => {
      element.style.setProperty("--dynamic-skew", `${skew.toFixed(2)}deg`);
      element.style.setProperty("--dynamic-shift", `${shift.toFixed(2)}px`);
    });

    frameId = window.requestAnimationFrame(applyMotion);
  };

  const measure = () => {
    syncChromeHeight();
    segmentHeight = source.offsetHeight;

    if (!segmentHeight) {
      return;
    }

    if (shell.scrollTop === 0) {
      shell.scrollTop = segmentHeight;
    }

    lastScrollTop = shell.scrollTop;
    lastTimestamp = performance.now();
    updateSceneStates(shell, scenes);
  };

  const handleScroll = () => {
    if (!segmentHeight || isResetting) {
      return;
    }

    const now = performance.now();
    const currentScrollTop = shell.scrollTop;
    const delta = currentScrollTop - lastScrollTop;
    const elapsed = Math.max(now - lastTimestamp, 16);

    velocity = delta / elapsed;
    lastScrollTop = currentScrollTop;
    lastTimestamp = now;

    if (currentScrollTop <= segmentHeight * 0.12) {
      isResetting = true;
      shell.scrollTop = currentScrollTop + segmentHeight;
      lastScrollTop = shell.scrollTop;
      window.requestAnimationFrame(() => {
        isResetting = false;
        updateSceneStates(shell, scenes);
      });
    } else if (currentScrollTop >= segmentHeight * 1.88) {
      isResetting = true;
      shell.scrollTop = currentScrollTop - segmentHeight;
      lastScrollTop = shell.scrollTop;
      window.requestAnimationFrame(() => {
        isResetting = false;
        updateSceneStates(shell, scenes);
      });
    } else {
      updateSceneStates(shell, scenes);
    }
  };

  shell.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure, { once: true });

  if (document.fonts?.ready) {
    document.fonts.ready.then(measure).catch(() => {});
  }

  measure();
  frameId = window.requestAnimationFrame(applyMotion);

  return {
    destroy() {
      shell.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(frameId);
      maskedHeadings.destroy();
      beforeClone.remove();
      afterClone.remove();
      root.style.removeProperty("--scroll-skew");
      root.style.removeProperty("--velocity-shift");
    },
  };
};

const initSecondaryPage = () => {
  const loops = Array.from(document.querySelectorAll("[data-loop-shell]"))
    .map((shell) => initLoopShell(shell))
    .filter(Boolean);

  syncChromeHeight();

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
