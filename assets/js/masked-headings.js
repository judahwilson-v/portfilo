const defaultReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

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

const splitMaskedHeading = (heading) => {
  if (!heading || heading.dataset.maskedHeadingReady === "true") {
    return Array.from(heading?.querySelectorAll(".heading-mask-char") ?? []);
  }

  const text = normalizeText(heading.textContent ?? "");

  if (!text) {
    return [];
  }

  heading.dataset.maskedHeadingReady = "true";
  heading.classList.add("heading-masked-reveal");
  heading.setAttribute("aria-label", text);

  const fragment = document.createDocumentFragment();
  const charNodes = [];
  const words = text.split(" ");
  let charIndex = 0;

  words.forEach((word, wordIndex) => {
    const mask = document.createElement("span");
    mask.className = "heading-mask-word";
    mask.setAttribute("aria-hidden", "true");

    const inner = document.createElement("span");
    inner.className = "heading-mask-word-inner";

    Array.from(word).forEach((character) => {
      const char = document.createElement("span");
      char.className = "heading-mask-char";
      char.textContent = character;
      char.style.setProperty("--char-index", String(charIndex));
      inner.append(char);
      charNodes.push(char);
      charIndex += 1;
    });

    mask.append(inner);
    fragment.append(mask);

    if (wordIndex < words.length - 1) {
      fragment.append(document.createTextNode(" "));
    }
  });

  heading.textContent = "";
  heading.append(fragment);

  return charNodes;
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

    const chars = splitMaskedHeading(heading);

    if (!chars.length) {
      return () => {};
    }

    return observeHeading(heading, { scroller, threshold, rootMargin });
  });

  return {
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
};
