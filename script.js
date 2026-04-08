import { createPortfolioSound } from "./assets/js/site-audio.js";

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

const sound = createPortfolioSound({
  menuRoot: document.querySelector("[data-sound-menu]"),
  autoLoopCues: ["mainAmbient"],
});

bindPortfolioSoundTargets(sound);
setupInfiniteLoops(sound);
