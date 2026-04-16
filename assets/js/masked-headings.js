import { gsap, ScrollTrigger, withScroller } from "./motion-system.js";

const canUseDOM = typeof window !== "undefined";
const defaultReducedMotion = canUseDOM
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;
const defaultFinePointer = canUseDOM
  ? window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
  : false;

const normalizeText = (text) => text.replace(/\s+/g, " ").trim();
const resolveHeadingUnit = (heading) => heading?.dataset.maskedHeadingUnit === "word" ? "word" : "char";
const resolveHeadingBehavior = (heading) => heading?.dataset.maskedHeadingBehavior === "scroll" ? "scroll" : "once";
const resolveHeadingProximity = (heading) => heading?.hasAttribute("data-variable-proximity") === true;

const parseVariationSettings = (settingsStr = "") => {
  return new Map(
    settingsStr
      .split(",")
      .map((setting) => setting.trim())
      .filter(Boolean)
      .map((setting) => {
        const match = setting.match(/['"]?([A-Za-z0-9]{4})['"]?\s*(-?\d*\.?\d+)/);
        return match ? [match[1], Number.parseFloat(match[2])] : null;
      })
      .filter(Boolean)
  );
};

const buildVariationSettings = (axes, key) => {
  return axes.map(({ axis, [key]: value }) => `'${axis}' ${Number(value.toFixed(2))}`).join(", ");
};

const applyVariationSettings = (node, settings, weightValue = null) => {
  if (!node) {
    return;
  }

  node.style.fontVariationSettings = settings;

  if (weightValue !== null) {
    node.style.fontWeight = String(weightValue);
  }
};

const calculateDistance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

const createVariableProximityHeading = (heading, items, { reducedMotion }) => {
  if (!heading || !items.length || reducedMotion || !defaultFinePointer || !resolveHeadingProximity(heading)) {
    return () => {};
  }

  const radius = Number.parseFloat(heading.dataset.variableProximityRadius ?? "120") || 120;
  const falloff = heading.dataset.variableProximityFalloff ?? "linear";
  const fromSettings = parseVariationSettings(heading.dataset.variableProximityFrom ?? "'wght' 520");
  const toSettings = parseVariationSettings(heading.dataset.variableProximityTo ?? "'wght' 800");
  const axisNames = new Set([...fromSettings.keys(), ...toSettings.keys()]);
  const axes = Array.from(axisNames).map((axis) => ({
    axis,
    fromValue: fromSettings.get(axis) ?? toSettings.get(axis) ?? 0,
    toValue: toSettings.get(axis) ?? fromSettings.get(axis) ?? 0,
  }));

  if (!axes.length) {
    return () => {};
  }

  const baseSettings = buildVariationSettings(axes, "fromValue");
  const baseWeight = axes.find(({ axis }) => axis === "wght")?.fromValue ?? null;
  const pointer = { x: -1e4, y: -1e4 };
  let rafId = 0;
  let frameQueued = false;
  let hasActiveState = false;
  const fontVariationSupported = window.CSS?.supports?.("font-variation-settings", "'wght' 500") ?? false;

  heading.classList.add("heading-variable-proximity");
  items.forEach((item) => applyVariationSettings(item, baseSettings, baseWeight));

  const calculateFalloff = (distance) => {
    const normalized = Math.min(Math.max(1 - distance / radius, 0), 1);

    switch (falloff) {
      case "exponential":
        return normalized ** 2;
      case "gaussian":
        return Math.exp(-((distance / (radius / 2)) ** 2) / 2);
      case "linear":
      default:
        return normalized;
    }
  };

  const resetItems = () => {
    if (!hasActiveState) {
      return;
    }

    items.forEach((item) => applyVariationSettings(item, baseSettings, baseWeight));
    hasActiveState = false;
  };

  const updateItems = () => {
    frameQueued = false;

    const headingRect = heading.getBoundingClientRect();
    const isNearHeading =
      pointer.x >= headingRect.left - radius &&
      pointer.x <= headingRect.right + radius &&
      pointer.y >= headingRect.top - radius &&
      pointer.y <= headingRect.bottom + radius;

    if (!isNearHeading) {
      resetItems();
      return;
    }

    hasActiveState = true;

    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const distance = calculateDistance(
        pointer.x,
        pointer.y,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );

      if (distance >= radius) {
        applyVariationSettings(item, baseSettings, baseWeight);
        return;
      }

      const proximity = calculateFalloff(distance);
      const values = axes.map(({ axis, fromValue, toValue }) => ({
        axis,
        value: fromValue + (toValue - fromValue) * proximity,
      }));
      const settings = values.map(({ axis, value }) => `'${axis}' ${Number(value.toFixed(2))}`).join(", ");
      const weight = values.find(({ axis }) => axis === "wght")?.value ?? null;

      applyVariationSettings(item, settings, weight);
    });
  };

  const queueUpdate = () => {
    if (frameQueued) {
      return;
    }

    frameQueued = true;
    rafId = window.requestAnimationFrame(updateItems);
  };

  const handlePointerMove = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    queueUpdate();
  };

  const handlePointerLeave = () => {
    pointer.x = -1e4;
    pointer.y = -1e4;
    queueUpdate();
  };

  const handleTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }

    pointer.x = touch.clientX;
    pointer.y = touch.clientY;
    queueUpdate();
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: true });
  window.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("resize", queueUpdate);
  window.addEventListener("scroll", queueUpdate, { passive: true });

  return () => {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("resize", queueUpdate);
    window.removeEventListener("scroll", queueUpdate);
    resetItems();
  };
};

const isHeadingVisible = (heading, scroller, insetRatio = 0.12) => {
  const shellRect = scroller?.getBoundingClientRect() ?? {
    top: 0,
    bottom: window.innerHeight,
  };
  const viewportHeight = scroller?.clientHeight ?? window.innerHeight;
  const inset = viewportHeight * insetRatio;
  const rect = heading.getBoundingClientRect();

  return rect.bottom > shellRect.top + inset && rect.top < shellRect.bottom - inset;
};

const splitMaskedHeading = (heading, unit = "char") => {
  if (!heading || heading.dataset.maskedHeadingReady === "true") {
    return Array.from(heading?.querySelectorAll(".heading-mask-token") ?? []);
  }

  const text = normalizeText(heading.textContent ?? "");

  if (!text) {
    return [];
  }

  heading.dataset.maskedHeadingReady = "true";
  heading.dataset.maskedHeadingUnit = unit;
  heading.classList.add("heading-masked-reveal");
  heading.setAttribute("aria-label", text);

  const fragment = document.createDocumentFragment();
  const motionNodes = [];
  const words = text.split(" ");
  let itemIndex = 0;

  words.forEach((word, wordIndex) => {
    const mask = document.createElement("span");
    mask.className = "heading-mask-word";
    mask.setAttribute("aria-hidden", "true");

    const inner = document.createElement("span");
    inner.className = "heading-mask-word-inner";

    if (unit === "word") {
      inner.classList.add("heading-mask-token");
      inner.textContent = word;
      inner.style.setProperty("--item-index", String(itemIndex));
      motionNodes.push(inner);
      itemIndex += 1;
    } else {
      Array.from(word).forEach((character) => {
        const char = document.createElement("span");
        char.className = "heading-mask-char heading-mask-token";
        char.textContent = character;
        char.style.setProperty("--item-index", String(itemIndex));
        inner.append(char);
        motionNodes.push(char);
        itemIndex += 1;
      });
    }

    mask.append(inner);
    fragment.append(mask);

    if (wordIndex < words.length - 1) {
      fragment.append(document.createTextNode(" "));
    }
  });

  heading.textContent = "";
  heading.append(fragment);

  return motionNodes;
};

const prepareReducedHeading = (heading) => {
  if (!heading || heading.dataset.maskedHeadingReady === "true") {
    return;
  }

  const text = normalizeText(heading.textContent ?? "");

  if (!text) {
    return;
  }

  heading.dataset.maskedHeadingReady = "true";
  heading.classList.add("heading-masked-reveal", "heading-masked-reveal--reduced");
};

const revealHeading = (heading) => {
  if (!heading || heading.dataset.maskedHeadingPlayed === "true") {
    return;
  }

  heading.dataset.maskedHeadingPlayed = "true";
  requestAnimationFrame(() => {
    heading.classList.add("is-revealed");
  });
};

const observeHeading = (heading, { scroller, threshold, rootMargin }) => {
  if (scroller) {
    let trigger = null;

    const revealFromScroll = () => {
      revealHeading(heading);
      trigger?.kill();
    };

    trigger = ScrollTrigger.create(
      withScroller(scroller, {
        trigger: heading,
        start: "top 82%",
        onEnter: revealFromScroll,
        onEnterBack: revealFromScroll,
      })
    );

    if (isHeadingVisible(heading, scroller)) {
      revealFromScroll();
    }

    return () => trigger?.kill();
  }

  if (!("IntersectionObserver" in window)) {
    revealHeading(heading);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        revealHeading(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      root: scroller,
      threshold,
      rootMargin,
    }
  );

  observer.observe(heading);

  if (isHeadingVisible(heading, scroller)) {
    revealHeading(heading);
    observer.unobserve(heading);
  }

  return () => observer.disconnect();
};

const animateScrollHeading = (heading, items, { scroller, unit }) => {
  if (!heading || !items.length) {
    return () => {};
  }

  heading.classList.add("heading-masked-reveal--timeline");

  const timeline = gsap.timeline({ paused: true });

  timeline.fromTo(
    items,
    {
      yPercent: 112,
      opacity: 0.02,
    },
    {
      yPercent: 0,
      opacity: 1,
      duration: unit === "word" ? 0.72 : 0.82,
      ease: "power3.out",
      stagger: unit === "word" ? 0.12 : 0.034,
    }
  );

  const trigger = ScrollTrigger.create(
    withScroller(scroller, {
      trigger: heading,
      start: scroller ? "top 78%" : "top 82%",
      end: scroller ? "bottom 36%" : "bottom 40%",
      onEnter: () => timeline.play(),
      onEnterBack: () => timeline.play(),
      onLeaveBack: () => timeline.reverse(),
    })
  );

  if (isHeadingVisible(heading, scroller, 0.18)) {
    timeline.progress(1);
  }

  return () => {
    trigger.kill();
    timeline.kill();
  };
};

export const initMaskedHeadings = ({
  root = document,
  scroller = null,
  selector = "[data-masked-heading]",
  reducedMotion = defaultReducedMotion,
  threshold = scroller ? 0.34 : 0.2,
  rootMargin = scroller ? "0px 0px -12% 0px" : "0px 0px -10% 0px",
} = {}) => {
  const headings = Array.from(root.querySelectorAll(selector));

  if (!headings.length) {
    return {
      destroy() {},
    };
  }

  const cleanups = headings.map((heading) => {
    if (reducedMotion) {
      prepareReducedHeading(heading);
      return observeHeading(heading, { scroller, threshold, rootMargin });
    }

    const unit = resolveHeadingUnit(heading);
    const behavior = resolveHeadingBehavior(heading);
    const items = splitMaskedHeading(heading, unit);

    if (!items.length) {
      return () => {};
    }

    const proximityCleanup = createVariableProximityHeading(heading, items, { reducedMotion });

    if (behavior === "scroll") {
      const animationCleanup = animateScrollHeading(heading, items, { scroller, unit });
      return () => {
        animationCleanup();
        proximityCleanup();
      };
    }

    const observerCleanup = observeHeading(heading, { scroller, threshold, rootMargin });
    return () => {
      observerCleanup();
      proximityCleanup();
    };
  });

  return {
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
};
