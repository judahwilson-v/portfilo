import { createPortfolioSound } from "./assets/js/site-audio.js";
import { createSignalCursor } from "./assets/js/site-cursor.js";

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const sanitizeClone = (node) => {
  node.querySelectorAll("[id]").forEach((element) => {
    element.removeAttribute("id");
  });

  node.querySelectorAll("a, button, input, textarea, select").forEach((element) => {
    element.setAttribute("tabindex", "-1");
    element.setAttribute("aria-hidden", "true");
    element.style.pointerEvents = "none";
  });
};

const bindPortfolioSoundTargets = (sound) => {
  if (!sound) {
    return;
  }

  const interactiveTargets = document.querySelectorAll(
    ".chrome-links a, .slab-link, .gateway-link, .contact-link"
  );

  sound.bindHover(interactiveTargets);
  sound.bindActivate(interactiveTargets);
};

const bindPortfolioCursorTargets = (cursor) => {
  if (!cursor?.enabled) {
    return;
  }

  cursor.bindTargets(document.querySelectorAll("[data-cursor-label]"));
};

const setupIndexLoader = () => {
  const loader = document.querySelector("#site-loader");
  const phaseNode = document.querySelector("#site-loader-phase");
  const copyNode = document.querySelector("#site-loader-copy");
  const heroImage = document.querySelector(".poster-frame img");

  if (!loader || !phaseNode || !copyNode) {
    return;
  }

  const phases = [
    {
      threshold: 0.22,
      label: "Skimming the lake surface",
      copy: "Filtering out the generic portfolio energy.",
    },
    {
      threshold: 0.52,
      label: "Amplifying the nameplate",
      copy: "Letting the first impression arrive before the links do.",
    },
    {
      threshold: 0.82,
      label: "Calibrating motion pressure",
      copy: "Making sure the scroll feels intentional instead of decorative.",
    },
    {
      threshold: 1,
      label: "Surface stable",
      copy: "You may now proceed with unreasonable curiosity.",
    },
  ];

  const waitForImage = heroImage
    ? heroImage.complete
      ? Promise.resolve()
      : typeof heroImage.decode === "function"
        ? heroImage.decode().catch(() => undefined)
        : new Promise((resolve) => {
            heroImage.addEventListener("load", resolve, { once: true });
            heroImage.addEventListener("error", resolve, { once: true });
          })
    : Promise.resolve();

  const waitForFonts =
    document.fonts && "ready" in document.fonts ? document.fonts.ready.catch(() => undefined) : Promise.resolve();

  const minimumDuration = reducedMotion ? 900 : 1900;
  const waitForMinimum = new Promise((resolve) => {
    window.setTimeout(resolve, minimumDuration);
  });

  const startTime = performance.now();
  let frameId = null;

  const step = (timestamp) => {
    const progress = clamp((timestamp - startTime) / minimumDuration, 0, 1);
    const phase =
      phases.find((entry) => progress <= entry.threshold) ?? phases[phases.length - 1];

    phaseNode.textContent = phase.label;
    copyNode.textContent = phase.copy;

    if (progress < 1) {
      frameId = window.requestAnimationFrame(step);
    }
  };

  frameId = window.requestAnimationFrame(step);

  Promise.all([waitForImage, waitForFonts, waitForMinimum]).then(() => {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }

    const finalPhase = phases[phases.length - 1];
    phaseNode.textContent = finalPhase.label;
    copyNode.textContent = finalPhase.copy;
    loader.classList.add("is-fading");
    window.setTimeout(() => {
      loader.setAttribute("hidden", "hidden");
    }, reducedMotion ? 180 : 760);
  });
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

const setupInfiniteLoops = (sound) => {
  const loopShells = document.querySelectorAll("[data-loop-shell]");

  if (!loopShells.length) {
    return;
  }

  loopShells.forEach((shell) => {
    if (!shell) {
      return;
    }

    const track = shell.querySelector("[data-loop-track]");
    const source = shell.querySelector("[data-loop-source]");

    if (!track || !source) {
      return;
    }

    const beforeClone = source.cloneNode(true);
    const afterClone = source.cloneNode(true);
    const sourceSceneCount = source.querySelectorAll("[data-scene]").length;

    sanitizeClone(beforeClone);
    sanitizeClone(afterClone);

    beforeClone.setAttribute("aria-hidden", "true");
    afterClone.setAttribute("aria-hidden", "true");

    track.prepend(beforeClone);
    track.append(afterClone);

    const scenes = Array.from(track.querySelectorAll("[data-scene]")).filter(Boolean);
    const scrollSlabs = Array.from(track.querySelectorAll("[data-scroll-slab]")).filter(Boolean);

    let segmentHeight = 0;
    let isResetting = false;
    let lastScrollTop = 0;
    let lastTimestamp = performance.now();
    let velocity = 0;
    let currentSceneLogicalIndex = null;

    const updateSlabMotion = () => {
      const skew = reducedMotion ? 0 : clamp(velocity * -0.045, -8, 8);
      const shift = reducedMotion ? 0 : clamp(Math.abs(velocity) * 2.4, 0, 24);

      root.style.setProperty("--scroll-skew", `${skew.toFixed(2)}deg`);
      root.style.setProperty("--velocity-shift", `${shift.toFixed(2)}px`);

      scrollSlabs.forEach((element) => {
        if (element) {
          element.style.setProperty("--dynamic-skew", `${skew.toFixed(2)}deg`);
          element.style.setProperty("--dynamic-shift", `${shift.toFixed(2)}px`);
        }
      });
    };

    const setCurrentScene = () => {
      const shellRect = shell.getBoundingClientRect();
      const shellCenter = shellRect.top + shell.clientHeight / 2;
      let nextSceneLogicalIndex = null;

      scenes.forEach((scene, index) => {
        if (!scene) {
          return;
        }

        const rect = scene.getBoundingClientRect();
        const sceneCenter = rect.top + rect.height / 2;
        const isCurrent = Math.abs(sceneCenter - shellCenter) < rect.height * 0.3;
        scene.classList.toggle("is-current", isCurrent);

        if (isCurrent) {
          nextSceneLogicalIndex = index % sourceSceneCount;
        }
      });

      if (nextSceneLogicalIndex === null) {
        return;
      }

      if (currentSceneLogicalIndex !== null && currentSceneLogicalIndex !== nextSceneLogicalIndex) {
        sound?.play("sectionShift", { cooldownMs: 1200 });
      }

      currentSceneLogicalIndex = nextSceneLogicalIndex;
    };

    const measure = () => {
      segmentHeight = source.offsetHeight;

      if (!segmentHeight) {
        return;
      }

      if (shell.scrollTop === 0) {
        shell.scrollTop = segmentHeight;
      }

      lastScrollTop = shell.scrollTop;
      setCurrentScene();
      updateSlabMotion();
    };

    const tick = () => {
      velocity *= 0.88;
      updateSlabMotion();
      requestAnimationFrame(tick);
    };

    shell.addEventListener(
      "scroll",
      () => {
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
          requestAnimationFrame(() => {
            isResetting = false;
          });
        } else if (currentScrollTop >= segmentHeight * 1.88) {
          isResetting = true;
          shell.scrollTop = currentScrollTop - segmentHeight;
          lastScrollTop = shell.scrollTop;
          requestAnimationFrame(() => {
            isResetting = false;
          });
        }

        setCurrentScene();
      },
      { passive: true }
    );

    window.addEventListener("resize", measure);

    measure();
    tick();
  });
};

createDynamicFavicon();
setupIndexLoader();

const sound = createPortfolioSound({
  menuRoot: document.querySelector("[data-sound-menu]"),
  autoLoopCues: ["mainAmbient"],
});

const cursor = createSignalCursor({
  defaultLabel: "Drift Gently",
  defaultAside: "the lake is calm. your tabs are not.",
});

bindPortfolioSoundTargets(sound);
bindPortfolioCursorTargets(cursor);
setupInfiniteLoops(sound);

window.addEventListener("pagehide", () => {
  cursor?.destroy();
});
