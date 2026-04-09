import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import { initMaskedHeadings } from "./masked-headings.js";
import { createPortfolioSound } from "./site-audio.js";
import { createSignalCursor } from "./site-cursor.js";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(any-hover: none), (any-pointer: coarse)").matches;
const loaderSessionKey = "lake-entry-seen";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const smoothstep = (start, end, value) => {
  if (end === start) {
    return value >= end ? 1 : 0;
  }

  const progress = clamp((value - start) / (end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

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
  node.setAttribute("data-loop-clone", "true");

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

const bindHomepageSoundTargets = (sound) => {
  if (!sound) {
    return;
  }

  const targets = document.querySelectorAll(
    ".chrome-links a, .scene-button, .scene-link, .social-link, .utility-link, .sound-toggle, .sound-choice, [data-sound-master-toggle], .cursor-toggle, [data-about-reveal]"
  );

  sound.bindHover(targets);
  sound.bindActivate(targets);
};

const bindHomepageCursorTargets = (cursor) => {
  if (!cursor) {
    return;
  }

  cursor.attachToggle(document.querySelectorAll("[data-cursor-toggle]"));
  cursor.bindTargets(document.querySelectorAll("[data-cursor-label]"));
};

const createDynamicFavicon = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  canvas.hidden = true;
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  let icon = document.querySelector("link[rel~='icon']");

  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.append(icon);
  }

  const square = {
    x: 8,
    y: 7,
    velocityX: 11,
    velocityY: 8.5,
    size: 10,
    angle: 0,
  };

  let frameId = 0;
  let lastTime = 0;
  let running = !document.hidden;

  const render = (time) => {
    if (!running) {
      return;
    }

    if (time - lastTime < (reducedMotion ? 1000 / 10 : 1000 / 18)) {
      frameId = requestAnimationFrame(render);
      return;
    }

    const delta = lastTime ? (time - lastTime) / 1000 : 0.016;
    lastTime = time;

    square.x += square.velocityX * delta;
    square.y += square.velocityY * delta;

    if (square.x <= 3 || square.x + square.size >= 29) {
      square.velocityX *= -1;
    }

    if (square.y <= 3 || square.y + square.size >= 22) {
      square.velocityY *= -1;
    }

    square.angle += delta * 2.4;

    context.clearRect(0, 0, 32, 32);
    context.fillStyle = "#070506";
    context.fillRect(0, 0, 32, 32);

    context.strokeStyle = "rgba(225, 29, 63, 0.34)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, 16);
    context.lineTo(32, 16);
    context.moveTo(16, 0);
    context.lineTo(16, 32);
    context.stroke();

    context.save();
    context.translate(square.x + square.size / 2, square.y + square.size / 2);
    context.rotate(square.angle);
    context.fillStyle = "#e11d3f";
    context.fillRect(-square.size / 2, -square.size / 2, square.size, square.size);
    context.strokeStyle = "#f6f0e7";
    context.strokeRect(-square.size / 2, -square.size / 2, square.size, square.size);
    context.restore();

    context.fillStyle = "#f6f0e7";
    context.font = "700 7px Space Grotesk, sans-serif";
    context.fillText("JVW", 4, 29);

    icon.href = canvas.toDataURL("image/png");
    frameId = requestAnimationFrame(render);
  };

  const setRunning = (nextState) => {
    if (nextState === running) {
      return;
    }

    running = nextState;

    if (running) {
      lastTime = 0;
      frameId = requestAnimationFrame(render);
      return;
    }

    cancelAnimationFrame(frameId);
  };

  document.addEventListener("visibilitychange", () => {
    setRunning(!document.hidden);
  });

  frameId = requestAnimationFrame(render);
};

const setupEntryGate = async () => {
  const loader = document.querySelector("#site-loader");
  const phase = document.querySelector("[data-loader-phase]");

  if (!loader || !phase) {
    return;
  }

  const previouslySeen = window.sessionStorage.getItem(loaderSessionKey) === "1";
  const phases = previouslySeen
    ? ["Re-entering lake layer", "Resetting scene timing", "Opening signal"]
    : ["Aligning interface drift", "Stretching the loop", "Letting the name land"];
  const holdTime = previouslySeen ? 560 : 1680;
  const phaseDelay = previouslySeen ? 180 : 360;

  loader.hidden = false;
  phase.textContent = phases[0];

  let phaseIndex = 0;
  const phaseTimer = window.setInterval(() => {
    phaseIndex = (phaseIndex + 1) % phases.length;
    phase.textContent = phases[phaseIndex];
  }, phaseDelay);

  await new Promise((resolve) => {
    window.setTimeout(resolve, holdTime);
  });

  window.clearInterval(phaseTimer);
  window.sessionStorage.setItem(loaderSessionKey, "1");
  loader.classList.add("is-fading");

  await new Promise((resolve) => {
    window.setTimeout(resolve, reducedMotion ? 120 : 620);
  });

  loader.hidden = true;
};

const setGatewayWordState = (word, { focus, isActive }) => {
  word.style.setProperty("--gateway-word-focus", focus.toFixed(4));
  word.classList.toggle("is-active", isActive);
};

const updateGatewayWords = (words, progress) => {
  if (!words.length) {
    return 0;
  }

  const phaseSize = 1 / words.length;
  const lastIndex = words.length - 1;
  const states = words.map((word, index) => {
    const phaseStart = index * phaseSize;
    const center = index === 0
      ? phaseStart + phaseSize * 0.16
      : index === lastIndex
        ? phaseStart + phaseSize * 0.84
        : phaseStart + phaseSize * 0.5;
    const linger = clamp(
      Number.parseFloat(word.dataset.gatewayWordLinger ?? "1"),
      0.75,
      2
    );
    const distance = Math.abs(progress - center);
    const plateau = phaseSize * 0.16 * linger;
    const falloff = phaseSize * 0.76 * linger;
    const focusRaw = distance <= plateau
      ? 1
      : clamp(1 - (distance - plateau) / falloff, 0, 1);

    return {
      focus: smoothstep(0, 1, focusRaw),
    };
  });

  const activeIndex = states.reduce((bestIndex, state, index) => {
    if (state.focus > states[bestIndex].focus) {
      return index;
    }

    return bestIndex;
  }, 0);

  states.forEach((state, index) => {
    setGatewayWordState(words[index], {
      focus: state.focus,
      isActive: index === activeIndex,
    });
  });

  return activeIndex;
};

const getGatewayWordTravel = (word) => {
  const speed = Number.parseFloat(word.dataset.gatewayWordSpeed ?? "0.4");
  return clamp(window.innerHeight * speed, 84, window.innerHeight * 0.68);
};

const sceneFocusProfiles = {
  hero: {
    currentBias: 0.44,
    focusSpread: 0.92,
    focusExponent: 1.22,
  },
  about: {
    currentBias: 0.34,
    focusSpread: 0.62,
    focusExponent: 1.62,
  },
  work: {
    currentBias: 0.48,
    focusSpread: 0.8,
    focusExponent: 1.35,
  },
  contact: {
    currentBias: 0.38,
    focusSpread: 0.66,
    focusExponent: 1.55,
  },
  default: {
    currentBias: 0.4,
    focusSpread: 0.64,
    focusExponent: 1.5,
  },
};

const updateSceneStates = (shell, scenes) => {
  const shellRect = shell.getBoundingClientRect();
  const shellCenter = shellRect.top + shell.clientHeight / 2;

  let currentScene = null;
  let highestFocus = Number.NEGATIVE_INFINITY;
  let nearestDistance = Number.POSITIVE_INFINITY;

  scenes.forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    const sceneCenter = rect.top + rect.height / 2;
    const distance = Math.abs(sceneCenter - shellCenter);
    const profile = sceneFocusProfiles[scene.dataset.sceneId] ?? sceneFocusProfiles.default;
    const focusDistance = Math.min(rect.height * profile.focusSpread, shell.clientHeight * profile.focusSpread);
    const rawFocus = clamp(1 - distance / focusDistance, 0, 1);
    const focus = Math.pow(rawFocus, profile.focusExponent);
    const isCurrent =
      distance < Math.min(rect.height * profile.currentBias, shell.clientHeight * profile.currentBias);

    scene.style.setProperty("--scene-focus", focus.toFixed(4));
    scene.classList.toggle("is-current", isCurrent);

    if (focus > highestFocus || (Math.abs(focus - highestFocus) < 0.001 && distance < nearestDistance)) {
      highestFocus = focus;
      nearestDistance = distance;
      currentScene = scene;
    }
  });

  const currentId = currentScene?.id || currentScene?.dataset.sceneId || null;

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    const isCurrent = href === `#${currentId}`;
    link.classList.toggle("is-active", isCurrent);
    link.setAttribute("aria-current", isCurrent ? "page" : "false");
  });
};

const setupParallax = ({ shell }) => {
  document.querySelectorAll("[data-parallax-speed]").forEach((element) => {
    const speed = Number.parseFloat(element.getAttribute("data-parallax-speed") ?? "0");
    const depth = Number.parseFloat(element.getAttribute("data-parallax-depth") ?? "0");
    const distance = clamp(speed * 160, -44, 44);
    const scale = 1 + depth * 0.01;

    gsap.fromTo(
      element,
      { y: -distance * 0.45, scale },
      {
        y: distance,
        scale,
        ease: "none",
        scrollTrigger: {
          trigger: element.closest("[data-scene]"),
          scroller: shell,
          start: "top bottom",
          end: "bottom top",
          scrub: reducedMotion ? false : 0.45,
        },
      }
    );
  });
};

const setupHeroEntrance = (scope = document) => {
  const title = scope.querySelector("[data-hero-title]");
  const statement = scope.querySelector("[data-hero-copy]");
  const actions = scope.querySelector(".hero-actions");
  const photo = scope.querySelector("[data-hero-photo]");
  const notes = scope.querySelectorAll(".hero-signal-line, .hero-satellite, .hero-orbit");

  if (!title) {
    return;
  }

  const secondaryTargets = [statement, actions, photo].filter(Boolean);

  const timeline = gsap.timeline({
    defaults: { ease: "power3.out" },
    delay: reducedMotion ? 0 : 0.12,
  });

  timeline.from(title.children, {
    yPercent: 100,
    opacity: 0,
    stagger: 0.08,
    duration: 0.9,
  });

  if (secondaryTargets.length) {
    timeline.from(
      secondaryTargets,
      {
        y: 36,
        opacity: 0,
        stagger: 0.1,
        duration: 0.7,
      },
      "-=0.38"
    );
  }

  if (notes.length) {
    timeline.from(
      notes,
      {
        y: 24,
        opacity: 0,
        stagger: 0.06,
        duration: 0.5,
      },
      secondaryTargets.length ? "-=0.28" : "-=0.32"
    );
  }
};

const setTextRevealPosition = (surface, clientX, clientY) => {
  const rect = surface.getBoundingClientRect();
  const x = clamp(clientX - rect.left, 0, rect.width);
  const y = clamp(clientY - rect.top, 0, rect.height);

  surface.style.setProperty("--text-reveal-x", `${x}px`);
  surface.style.setProperty("--text-reveal-y", `${y}px`);
};

const setTextRevealCenter = (surface) => {
  const rect = surface.getBoundingClientRect();
  surface.style.setProperty("--text-reveal-x", `${rect.width / 2}px`);
  surface.style.setProperty("--text-reveal-y", `${rect.height / 2}px`);
};

const bindMaskedRevealSurface = (surface, { coarsePointer = false, allowTapLock = false } = {}) => {
  if (!surface) {
    return;
  }

  setTextRevealCenter(surface);

  const armSurface = () => {
    surface.classList.add("is-armed");
  };

  const disarmSurface = () => {
    surface.classList.remove("is-armed");
  };

  surface.addEventListener("pointerenter", (event) => {
    setTextRevealPosition(surface, event.clientX, event.clientY);
    armSurface();
  });

  surface.addEventListener("pointermove", (event) => {
    setTextRevealPosition(surface, event.clientX, event.clientY);
  });

  surface.addEventListener("pointerleave", () => {
    if (surface.matches(":focus-visible")) {
      return;
    }

    disarmSurface();
    setTextRevealCenter(surface);
  });

  surface.addEventListener("focus", () => {
    setTextRevealCenter(surface);
    armSurface();
  });

  surface.addEventListener("blur", () => {
    if (coarsePointer && allowTapLock && surface.dataset.tapLocked === "true") {
      return;
    }

    disarmSurface();
  });

  if (!coarsePointer || !allowTapLock) {
    return;
  }

  surface.addEventListener("click", (event) => {
    const isArmed = surface.dataset.tapLocked !== "true";

    surface.classList.toggle("is-armed", isArmed);
    surface.dataset.tapLocked = isArmed ? "true" : "false";
    setTextRevealPosition(surface, event.clientX, event.clientY);
  });
};

const setupAboutScene = ({ shell }) => {
  document.querySelectorAll(".scene-about").forEach((scene) => {
    const meta = scene.querySelector(".about-meta");
    const surface = scene.querySelector("[data-about-reveal]");
    const hint = scene.querySelector(".about-hint");

    if (!surface) {
      return;
    }

    bindMaskedRevealSurface(surface, { coarsePointer, allowTapLock: true });

    const introTargets = [meta, surface, hint].filter(Boolean);

    if (introTargets.length) {
      gsap.fromTo(
        introTargets,
        {
          y: reducedMotion ? 0 : 34,
          opacity: reducedMotion ? 1 : 0,
        },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: scene,
            scroller: shell,
            start: "top 80%",
          },
        }
      );
    }
  });
};

const setupGatewayScene = ({ shell }) => {
  document.querySelectorAll(".scene-gateway").forEach((scene) => {
    const copyTargets = Array.from(scene.querySelectorAll("[data-gateway-fade]"));
    const words = Array.from(scene.querySelectorAll("[data-gateway-word]"));

    if (!words.length) {
      return;
    }

    scene.classList.add("is-staged");
    updateGatewayWords(words, 0);
    words.forEach((word) => {
      bindMaskedRevealSurface(word);
    });

    if (!reducedMotion) {
      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: {
            trigger: scene,
            scroller: shell,
            start: "top 82%",
            toggleActions: "play none none none",
          },
        })
        .from(copyTargets, {
          y: 24,
          opacity: 0,
          stagger: 0.08,
          duration: 0.64,
          clearProps: "transform,opacity",
        });

      const stackTimeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: scene,
          scroller: shell,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.45,
          invalidateOnRefresh: true,
        },
      });

      words.forEach((word) => {
        stackTimeline.fromTo(
          word,
          {
            y: 0,
          },
          {
            y: () => -getGatewayWordTravel(word),
          },
          0
        );
      });
    }

    ScrollTrigger.create({
      trigger: scene,
      scroller: shell,
      start: "top top",
      end: "bottom bottom",
      scrub: reducedMotion ? false : 0.45,
      onRefresh: (self) => {
        updateGatewayWords(words, self.progress);
      },
      onUpdate: (self) => {
        updateGatewayWords(words, self.progress);
      },
    });
  });
};

const setupContactScene = ({ shell }) => {
  document.querySelectorAll(".scene-contact").forEach((scene) => {
    const panelElements = Array.from(scene.querySelectorAll(".contact-panel > :not([data-masked-heading])"));
    const socialElements = Array.from(scene.querySelectorAll(".contact-socials > *"));
    const backdrop = scene.querySelector(".contact-backdrop");
    const revealLinks = Array.from(scene.querySelectorAll(".social-link[data-text-reveal]"));
    const contentTargets = [...panelElements, ...socialElements];

    revealLinks.forEach((link) => {
      bindMaskedRevealSurface(link);
    });

    if (contentTargets.length) {
      gsap.fromTo(
        contentTargets,
        {
          y: reducedMotion ? 0 : 36,
          opacity: reducedMotion ? 1 : 0.2,
        },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: "power2.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: scene,
            scroller: shell,
            start: "top 82%",
          },
        }
      );
    }

    if (backdrop && !reducedMotion) {
      gsap.fromTo(
        backdrop,
        { yPercent: -8 },
        {
          yPercent: 8,
          ease: "none",
        scrollTrigger: {
          trigger: scene,
          scroller: shell,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.45,
        },
      }
    );
    }
  });
};

const setupAnchorNavigation = ({ lenis, source, getSegmentHeight }) => {
  const scrollToHash = (hash, immediate = false) => {
    if (!hash?.startsWith("#")) {
      return;
    }

    const target = source.querySelector(hash);

    if (!target) {
      return;
    }

    const lead = clamp(window.innerHeight * 0.12, 64, 140);
    const destination = getSegmentHeight() + target.offsetTop - lead;

    lenis.scrollTo(destination, {
      immediate,
      duration: reducedMotion ? 0 : 1.15,
      force: true,
    });
  };

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");

      if (!href?.startsWith("#")) {
        return;
      }

      event.preventDefault();
      history.replaceState(null, "", href);
      scrollToHash(href);
    });
  });

  window.addEventListener("hashchange", () => {
    scrollToHash(window.location.hash, false);
  });

  window.requestAnimationFrame(() => {
    scrollToHash(window.location.hash || "#hero", true);
  });
};

const setupInfiniteHomepage = () => {
  const shell = document.querySelector("[data-loop-shell]");
  const track = document.querySelector("[data-loop-track]");
  const source = document.querySelector("[data-loop-source]");

  if (!shell || !track || !source) {
    return null;
  }

  const beforeClone = source.cloneNode(true);
  const afterClone = source.cloneNode(true);

  sanitizeClone(beforeClone);
  sanitizeClone(afterClone);

  track.prepend(beforeClone);
  track.append(afterClone);

  const loopScenes = Array.from(track.querySelectorAll("[data-scene]"));
  const maskedHeadings = initMaskedHeadings({
    root: source,
    scroller: shell,
    reducedMotion,
  });
  const lenis = new Lenis({
    wrapper: shell,
    content: track,
    duration: reducedMotion ? 0 : 0.82,
    smoothWheel: !reducedMotion,
    syncTouch: false,
    gestureOrientation: "vertical",
    autoRaf: false,
  });

  ScrollTrigger.scrollerProxy(shell, {
    scrollTop(value) {
      if (typeof value === "number") {
        lenis.scrollTo(value, { immediate: true, force: true });
      }

      return shell.scrollTop;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
    pinType: "transform",
  });

  ScrollTrigger.defaults({ scroller: shell });

  let segmentHeight = 0;
  let frameId = 0;
  let isResetting = false;

  const setVelocityVariables = (velocity = 0) => {
    const skew = reducedMotion || coarsePointer ? 0 : clamp(velocity * -0.0018, -0.45, 0.45);
    const shift = reducedMotion || coarsePointer ? 0 : clamp(Math.abs(velocity) * 0.03, 0, 2.2);
    root.style.setProperty("--scroll-skew", `${skew.toFixed(2)}deg`);
    root.style.setProperty("--velocity-shift", `${shift.toFixed(2)}px`);
  };

  const measure = () => {
    segmentHeight = source.offsetHeight;

    if (!segmentHeight) {
      return;
    }

    if (shell.scrollTop === 0) {
      lenis.scrollTo(segmentHeight, { immediate: true, force: true });
    }

    updateSceneStates(shell, loopScenes);
  };

  lenis.on("scroll", (event) => {
    if (!segmentHeight) {
      return;
    }

    setVelocityVariables(event.velocity ?? 0);
    updateSceneStates(shell, loopScenes);

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
        updateSceneStates(shell, loopScenes);
      });
    } else if (currentScrollTop > sourceEnd + wrapBuffer) {
      isResetting = true;
      lenis.scrollTo(currentScrollTop - segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => {
        isResetting = false;
        ScrollTrigger.update();
        updateSceneStates(shell, loopScenes);
      });
    }
  });

  const raf = (time) => {
    lenis.raf(time);
    frameId = requestAnimationFrame(raf);
  };

  frameId = requestAnimationFrame(raf);

  setupAboutScene({ shell });
  setupGatewayScene({ shell });
  setupContactScene({ shell });
  setupParallax({ shell });

  lenis.on("scroll", ScrollTrigger.update);

  const handleResize = () => {
    measure();
    ScrollTrigger.refresh();
  };

  window.addEventListener("resize", handleResize);
  ScrollTrigger.addEventListener("refresh", measure);

  measure();
  ScrollTrigger.refresh();

  setupAnchorNavigation({
    lenis,
    source,
    getSegmentHeight: () => segmentHeight,
  });

  return {
    destroy() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.removeEventListener("refresh", measure);
      lenis.destroy();
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
    },
  };
};

const bootHomepage = async () => {
  createDynamicFavicon();

  const sound = createPortfolioSound({
    menuRoot: document.querySelector("[data-sound-menu]"),
    autoLoopCues: ["mainAmbient"],
  });

  const cursor = createSignalCursor({
    defaultLabel: "Lake Cursor",
    defaultAside: "hover with intent. chaos is expensive.",
    defaultMode: "default",
  });

  bindHomepageSoundTargets(sound);
  bindHomepageCursorTargets(cursor);

  await setupEntryGate();

  const homepage = setupInfiniteHomepage();

  window.addEventListener("pagehide", () => {
    homepage?.destroy();
    cursor?.destroy();
    sound?.destroy();
  });
};

bootHomepage();
