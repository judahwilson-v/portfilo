import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import { createPortfolioSound } from "./assets/js/site-audio.js";
import { createSignalCursor } from "./assets/js/site-cursor.js";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const sanitizeClone = (node) => {
  node.querySelectorAll("[id]").forEach((element) => {
    element.removeAttribute("id");
  });

  node.querySelectorAll("a, button, input, textarea, select, summary").forEach((element) => {
    element.setAttribute("tabindex", "-1");
    element.setAttribute("aria-hidden", "true");
    element.style.pointerEvents = "none";
  });
};

const bindHomepageSoundTargets = (sound) => {
  if (!sound) {
    return;
  }

  const interactiveTargets = document.querySelectorAll(
    ".chrome-links a, .scene-button, .scene-link, .utility-link, .social-link, .sound-toggle, .sound-choice, [data-sound-master-toggle], #enter-site"
  );

  sound.bindHover(interactiveTargets);
  sound.bindActivate(interactiveTargets);
};

const bindHomepageCursorTargets = (cursor) => {
  if (!cursor?.enabled) {
    return;
  }

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
    context.fillStyle = "#05070b";
    context.fillRect(0, 0, 32, 32);

    context.strokeStyle = "rgba(133, 221, 255, 0.35)";
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
    context.fillStyle = "#c8ff62";
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
  const enterButton = document.querySelector("#enter-site");

  if (!loader || !enterButton) {
    return;
  }

  const sessionKey = "lake-entry-seen";
  const previouslySeen = window.sessionStorage.getItem(sessionKey) === "1";

  if (previouslySeen) {
    loader.setAttribute("hidden", "hidden");
    return;
  }

  await new Promise((resolve) => {
    enterButton.addEventListener(
      "click",
      () => {
        window.sessionStorage.setItem(sessionKey, "1");
        loader.classList.add("is-fading");

        window.setTimeout(() => {
          loader.setAttribute("hidden", "hidden");
          resolve();
        }, reducedMotion ? 120 : 520);
      },
      { once: true }
    );
  });
};

const setupParallax = ({ shell }) => {
  document.querySelectorAll("[data-parallax-speed]").forEach((element) => {
    const speed = Number.parseFloat(element.getAttribute("data-parallax-speed") ?? "0");
    const depth = Number.parseFloat(element.getAttribute("data-parallax-depth") ?? "0");
    const distance = clamp(speed * 180, -56, 56);
    const scale = 1 + depth * 0.015;

    gsap.fromTo(
      element,
      { y: -distance * 0.5, scale },
      {
        y: distance,
        scale,
        ease: "none",
        scrollTrigger: {
          trigger: element.closest("[data-scene]"),
          scroller: shell,
          start: "top bottom",
          end: "bottom top",
          scrub: reducedMotion ? false : 0.7,
        },
      }
    );
  });
};

const updateSceneStates = (shell, scenes) => {
  const shellRect = shell.getBoundingClientRect();
  const shellCenter = shellRect.top + shell.clientHeight / 2;

  scenes.forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    const sceneCenter = rect.top + rect.height / 2;
    const isCurrent = Math.abs(sceneCenter - shellCenter) < rect.height * 0.28;
    scene.classList.toggle("is-current", isCurrent);
  });
};

const setWorkActive = (scope, index) => {
  scope.querySelectorAll("[data-project-visual]").forEach((element) => {
    element.classList.toggle("is-active", Number(element.dataset.projectVisual) === index);
  });

  scope.querySelectorAll("[data-project-detail]").forEach((element) => {
    element.classList.toggle("is-active", Number(element.dataset.projectDetail) === index);
  });

  scope.querySelectorAll("[data-work-step]").forEach((element) => {
    element.classList.toggle("is-active", Number(element.dataset.workStep) === index);
  });
};

const setupHeroEntrance = ({ shell }) => {
  document.querySelectorAll(".scene-hero").forEach((scene) => {
    const title = scene.querySelector("[data-hero-title]");
    const copy = scene.querySelector("[data-hero-copy]");
    const portrait = scene.querySelector(".hero-portrait");
    const panel = scene.querySelector(".hero-panel");
    const footer = scene.querySelector(".hero-footer");

    if (!title || !copy || !portrait || !panel || !footer) {
      return;
    }

    gsap.timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: reducedMotion
        ? undefined
        : {
            trigger: scene,
            scroller: shell,
            start: "top 70%",
          },
    })
      .from(title.children, {
        yPercent: 100,
        opacity: 0,
        stagger: 0.08,
        duration: 0.9,
      })
      .from(
        [copy, portrait, panel, footer],
        {
          y: 48,
          opacity: 0,
          stagger: 0.1,
          duration: 0.85,
        },
        "-=0.45"
      );
  });
};

const setupAboutScenes = ({ shell }) => {
  document.querySelectorAll(".scene-about").forEach((scene) => {
    const capabilities = Array.from(scene.querySelectorAll("[data-capability]"));

    capabilities.forEach((item, index) => {
      ScrollTrigger.create({
        trigger: scene,
        scroller: shell,
        start: "top top",
        end: "bottom bottom",
        scrub: reducedMotion ? false : 0.8,
        onUpdate: (self) => {
          const progress = self.progress;
          const itemStart = index / capabilities.length;
          const itemEnd = (index + 1) / capabilities.length + 0.06;
          const isActive = progress >= itemStart && progress <= itemEnd;
          item.classList.toggle("is-active", isActive || (!reducedMotion && progress > itemEnd));
        },
      });

      gsap.fromTo(
        item,
        {
          y: reducedMotion ? 0 : 24,
          opacity: reducedMotion ? 1 : 0.24,
        },
        {
          y: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: scene,
            scroller: shell,
            start: () => `top top+=${index * 120}`,
            end: () => `top top+=${(index + 1.5) * 120}`,
            scrub: reducedMotion ? false : 0.7,
          },
        }
      );
    });
  });
};

const setupWorkScenes = ({ shell }) => {
  document.querySelectorAll(".scene-work").forEach((scene) => {
    const visuals = Array.from(scene.querySelectorAll("[data-project-visual]"));
    const details = Array.from(scene.querySelectorAll("[data-project-detail]"));

    if (!visuals.length || !details.length) {
      return;
    }

    const trigger = ScrollTrigger.create({
      trigger: scene,
      scroller: shell,
      start: "top top",
      end: "bottom bottom",
      scrub: reducedMotion ? false : 0.85,
      onUpdate: (self) => {
        const rawIndex = Math.round(self.progress * (visuals.length - 1));
        const activeIndex = clamp(rawIndex, 0, visuals.length - 1);
        setWorkActive(scene, activeIndex);
      },
    });

    if (reducedMotion) {
      setWorkActive(scene, 0);
      return trigger;
    }

    visuals.forEach((visual) => {
      gsap.fromTo(
        visual,
        { scale: 1.08 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: scene,
            scroller: shell,
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    });

    details.forEach((detail) => {
      gsap.fromTo(
        detail,
        { y: 24 },
        {
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: scene,
            scroller: shell,
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    });

    return trigger;
  });
};

const setupContactScenes = ({ shell }) => {
  document.querySelectorAll(".scene-contact").forEach((scene) => {
    const proof = scene.querySelector(".contact-proof");
    const panel = scene.querySelector(".contact-panel");
    const backdrop = scene.querySelector(".contact-backdrop");

    if (!proof || !panel || !backdrop) {
      return;
    }

    gsap.fromTo(
      [proof, panel],
      {
        y: reducedMotion ? 0 : 40,
        opacity: reducedMotion ? 1 : 0.25,
      },
      {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: {
          trigger: scene,
          scroller: shell,
          start: "top 72%",
        },
      }
    );

    if (!reducedMotion) {
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
            scrub: 0.8,
          },
        }
      );
    }
  });
};

const setupAnchorNavigation = ({ lenis, source, getSegmentHeight }) => {
  const scrollToHash = (hash, immediate = false) => {
    if (!hash || !hash.startsWith("#")) {
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
      duration: reducedMotion ? 0 : 1.25,
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

  beforeClone.setAttribute("aria-hidden", "true");
  afterClone.setAttribute("aria-hidden", "true");

  track.prepend(beforeClone);
  track.append(afterClone);

  const scenes = Array.from(track.querySelectorAll("[data-scene]"));

  const lenis = new Lenis({
    wrapper: shell,
    content: track,
    duration: reducedMotion ? 0 : 1.08,
    smoothWheel: !reducedMotion,
    syncTouch: true,
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

  let segmentHeight = 0;
  let rafId = 0;
  let isResetting = false;

  const setVelocityVariables = (velocity = 0) => {
    const skew = reducedMotion ? 0 : clamp(velocity * -0.01, -2.4, 2.4);
    const shift = reducedMotion ? 0 : clamp(Math.abs(velocity) * 0.2, 0, 10);
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

    updateSceneStates(shell, scenes);
  };

  lenis.on("scroll", (event) => {
    if (!segmentHeight) {
      return;
    }

    setVelocityVariables(event.velocity ?? 0);
    updateSceneStates(shell, scenes);

    if (isResetting) {
      return;
    }

    const currentScrollTop = shell.scrollTop;

    if (currentScrollTop <= segmentHeight * 0.12) {
      isResetting = true;
      lenis.scrollTo(currentScrollTop + segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => {
        isResetting = false;
        ScrollTrigger.update();
        updateSceneStates(shell, scenes);
      });
    } else if (currentScrollTop >= segmentHeight * 1.88) {
      isResetting = true;
      lenis.scrollTo(currentScrollTop - segmentHeight, { immediate: true, force: true });
      requestAnimationFrame(() => {
        isResetting = false;
        ScrollTrigger.update();
        updateSceneStates(shell, scenes);
      });
    }
  });

  const raf = (time) => {
    lenis.raf(time);
    rafId = requestAnimationFrame(raf);
  };

  rafId = requestAnimationFrame(raf);

  setupHeroEntrance({ shell });
  setupAboutScenes({ shell });
  setupWorkScenes({ shell });
  setupContactScenes({ shell });
  setupParallax({ shell });

  ScrollTrigger.defaults({ scroller: shell });
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
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.removeEventListener("refresh", measure);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.scroller === shell) {
          trigger.kill();
        }
      });
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
    defaultLabel: "",
    defaultAside: "",
    defaultMode: "default",
  });

  bindHomepageSoundTargets(sound);
  bindHomepageCursorTargets(cursor);

  await setupEntryGate();

  const homepage = setupInfiniteHomepage();

  window.addEventListener("pagehide", () => {
    homepage?.destroy();
    cursor?.destroy();
  });
};

bootHomepage();
