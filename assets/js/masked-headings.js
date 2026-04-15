import { gsap, ScrollTrigger, withScroller } from "./motion-system.js";

const defaultReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const normalizeText = (text) => text.replace(/\s+/g, " ").trim();
const resolveHeadingUnit = (heading) => heading?.dataset.maskedHeadingUnit === "word" ? "word" : "char";
const resolveHeadingBehavior = (heading) => heading?.dataset.maskedHeadingBehavior === "scroll" ? "scroll" : "once";

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

    if (behavior === "scroll") {
      return animateScrollHeading(heading, items, { scroller, unit });
    }

    return observeHeading(heading, { scroller, threshold, rootMargin });
  });

  return {
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
};
