const root = document.documentElement;
const progressBar = document.querySelector(".scroll-progress");
const revealItems = document.querySelectorAll("[data-reveal]");
const navLinks = Array.from(document.querySelectorAll(".site-nav a[href^='#']"));
const trackedSections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
const trajectoryList = document.querySelector(".trajectory-list");
const heroVisual = document.querySelector(".hero-visual");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateScrollProgress = () => {
  if (!progressBar) {
    return;
  }

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  progressBar.style.transform = `scaleX(${progress})`;
};

const updateTrajectoryProgress = () => {
  if (!trajectoryList) {
    return;
  }

  const rect = trajectoryList.getBoundingClientRect();
  const progress = clamp((window.innerHeight * 0.72 - rect.top) / rect.height, 0, 1);
  root.style.setProperty("--trajectory-progress", progress.toFixed(3));
};

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    threshold: 0.16,
    rootMargin: "0px 0px -8% 0px",
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

if (trackedSections.length > 0) {
  const sectionRatios = new Map();

  const syncActiveNav = () => {
    const nextActive = Array.from(sectionRatios.entries())
      .sort((left, right) => right[1] - left[1])
      .find(([, ratio]) => ratio > 0.15);

    navLinks.forEach((link) => {
      const targetId = link.getAttribute("href");
      link.classList.toggle("is-active", targetId === `#${nextActive?.[0] || ""}`);
    });
  };

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        sectionRatios.set(entry.target.id, entry.intersectionRatio);
      });

      syncActiveNav();
    },
    {
      threshold: [0.15, 0.3, 0.45, 0.6, 0.75],
    }
  );

  trackedSections.forEach((section) => sectionObserver.observe(section));
}

updateScrollProgress();
updateTrajectoryProgress();

window.addEventListener(
  "scroll",
  () => {
    updateScrollProgress();
    updateTrajectoryProgress();
  },
  { passive: true }
);

window.addEventListener("resize", updateTrajectoryProgress);

const supportsFinePointer =
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (supportsFinePointer) {
  const ring = document.querySelector(".cursor-ring");
  const dot = document.querySelector(".cursor-dot");
  const label = document.querySelector(".cursor-label");
  const hoverTargets = document.querySelectorAll("a, button, [data-cursor]");
  const magneticTargets = document.querySelectorAll("[data-magnetic]");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  const animateCursor = () => {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;

    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;

    root.style.setProperty("--pointer-x", `${mouseX}px`);
    root.style.setProperty("--pointer-y", `${mouseY}px`);

    requestAnimationFrame(animateCursor);
  };

  const activateCursor = () => {
    ring.classList.add("is-active");
    dot.classList.add("is-active");
  };

  const resetCursorText = () => {
    label.textContent = "Move";
    ring.classList.remove("cursor-hover");
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      activateCursor();
    },
    { passive: true }
  );

  window.addEventListener("pointerdown", () => {
    ring.classList.add("cursor-hover");
  });

  window.addEventListener("pointerup", () => {
    ring.classList.remove("cursor-hover");
  });

  document.addEventListener("mouseleave", () => {
    ring.classList.remove("is-active", "cursor-hover");
    dot.classList.remove("is-active");
  });

  hoverTargets.forEach((target) => {
    target.addEventListener("pointerenter", () => {
      label.textContent = target.dataset.cursor || "Open";
      ring.classList.add("cursor-hover");
    });

    target.addEventListener("pointerleave", () => {
      resetCursorText();
    });
  });

  magneticTargets.forEach((target) => {
    target.addEventListener("pointermove", (event) => {
      const bounds = target.getBoundingClientRect();
      const x = event.clientX - bounds.left - bounds.width / 2;
      const y = event.clientY - bounds.top - bounds.height / 2;

      target.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
    });

    target.addEventListener("pointerleave", () => {
      target.style.transform = "";
    });
  });

  if (heroVisual) {
    heroVisual.addEventListener("pointermove", (event) => {
      const bounds = heroVisual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;

      root.style.setProperty("--tilt-x", `${x * 8}deg`);
      root.style.setProperty("--tilt-y", `${y * -8}deg`);
      root.style.setProperty("--image-shift-x", `${x * -14}px`);
      root.style.setProperty("--image-shift-y", `${y * -14}px`);
    });

    heroVisual.addEventListener("pointerleave", () => {
      root.style.setProperty("--tilt-x", "0deg");
      root.style.setProperty("--tilt-y", "0deg");
      root.style.setProperty("--image-shift-x", "0px");
      root.style.setProperty("--image-shift-y", "0px");
    });
  }

  animateCursor();
}
