import gsap from "https://esm.sh/gsap@3.13.0";
import { ScrollTrigger } from "https://esm.sh/gsap@3.13.0/ScrollTrigger";
import Lenis from "https://esm.sh/lenis@1.3.4";

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const coarsePointer = window.matchMedia("(any-hover: none), (any-pointer: coarse)").matches;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const withScroller = (scroller, config = {}) => ({ ...config, scroller });

export const createSmoothScroller = ({
  wrapper,
  content = wrapper?.firstElementChild ?? wrapper,
  duration = reducedMotion ? 0 : 1.02,
  lerp = reducedMotion ? undefined : coarsePointer ? 0.18 : 0.11,
  wheelMultiplier = coarsePointer ? 1 : 0.94,
  touchMultiplier = 1,
  onScroll,
  syncScrollTrigger = false,
}) => {
  if (!wrapper || !content) {
    return null;
  }

  const lenisOptions = {
    wrapper,
    content,
    smoothWheel: !reducedMotion,
    syncTouch: false,
    gestureOrientation: "vertical",
    autoRaf: false,
    wheelMultiplier,
    touchMultiplier,
  };

  if (reducedMotion) {
    lenisOptions.duration = 0;
  } else if (typeof lerp === "number") {
    lenisOptions.lerp = lerp;
  } else {
    lenisOptions.duration = duration;
  }

  const lenis = new Lenis(lenisOptions);

  let frameId = 0;
  const raf = (time) => {
    lenis.raf(time);
    frameId = window.requestAnimationFrame(raf);
  };

  if (syncScrollTrigger) {
    ScrollTrigger.scrollerProxy(wrapper, {
      scrollTop(value) {
        if (typeof value === "number") {
          lenis.scrollTo(value, { immediate: true, force: true });
        }

        return wrapper.scrollTop;
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

    lenis.on("scroll", ScrollTrigger.update);
  }

  if (typeof onScroll === "function") {
    lenis.on("scroll", onScroll);
  }

  frameId = window.requestAnimationFrame(raf);

  return {
    lenis,
    destroy() {
      window.cancelAnimationFrame(frameId);
      lenis.destroy();
    },
  };
};

export const animateBatchIn = ({
  targets,
  trigger,
  scroller,
  start = "top 82%",
  fromY = 32,
  fromOpacity = 0,
  stagger = 0.08,
  duration = 0.82,
  ease = "power3.out",
}) => {
  const items = Array.from(targets ?? []).filter(Boolean);

  if (!items.length) {
    return null;
  }

  if (reducedMotion) {
    gsap.set(items, { clearProps: "all", opacity: 1, y: 0 });
    return null;
  }

  return gsap.fromTo(
    items,
    {
      y: fromY,
      opacity: fromOpacity,
    },
    {
      y: 0,
      opacity: 1,
      duration,
      stagger,
      ease,
      clearProps: "transform,opacity",
      scrollTrigger: withScroller(scroller, {
        trigger,
        start,
      }),
    }
  );
};

export { gsap, ScrollTrigger, Lenis };
