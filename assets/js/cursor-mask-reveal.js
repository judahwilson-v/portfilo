import { clamp, coarsePointer as coarsePointerDevice } from "./motion-system.js";

const coarseSurfaces = new Set();
let coarseResetBound = false;

const setRevealPosition = (surface, x, y) => {
  surface.style.setProperty("--text-reveal-x", `${x}px`);
  surface.style.setProperty("--text-reveal-y", `${y}px`);
};

const setRevealCenter = (surface) => {
  const rect = surface.getBoundingClientRect();
  setRevealPosition(surface, rect.width / 2, rect.height / 2);
};

const registerCoarseReset = () => {
  if (coarseResetBound) {
    return;
  }

  coarseResetBound = true;

  document.addEventListener(
    "pointerdown",
    (event) => {
      coarseSurfaces.forEach((entry) => {
        if (!entry.surface.isConnected) {
          coarseSurfaces.delete(entry);
          return;
        }

        if (entry.surface.contains(event.target)) {
          return;
        }

        entry.reset();
      });
    },
    true
  );
};

export const bindCursorMaskReveal = (
  surface,
  {
    coarsePointer = coarsePointerDevice,
    allowTapLock = false,
    lockOnPrimaryAction = false,
    lockToCenter = false,
    lerp = coarsePointer ? 0.34 : 0.18,
  } = {}
) => {
  if (!surface) {
    return null;
  }

  const state = {
    active: false,
    locked: false,
    running: false,
    rafId: 0,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
  };

  const updatePosition = (clientX, clientY) => {
    if (lockToCenter) {
      const rect = surface.getBoundingClientRect();
      state.targetX = rect.width / 2;
      state.targetY = rect.height / 2;
      return;
    }

    const rect = surface.getBoundingClientRect();
    state.targetX = clamp(clientX - rect.left, 0, rect.width);
    state.targetY = clamp(clientY - rect.top, 0, rect.height);
  };

  const render = () => {
    state.currentX += (state.targetX - state.currentX) * lerp;
    state.currentY += (state.targetY - state.currentY) * lerp;

    setRevealPosition(surface, state.currentX, state.currentY);

    const deltaX = Math.abs(state.targetX - state.currentX);
    const deltaY = Math.abs(state.targetY - state.currentY);

    if (state.active || deltaX > 0.18 || deltaY > 0.18) {
      state.rafId = window.requestAnimationFrame(render);
      return;
    }

    state.running = false;
    state.rafId = 0;
  };

  const startLoop = () => {
    if (state.running) {
      return;
    }

    state.running = true;
    state.rafId = window.requestAnimationFrame(render);
  };

  const arm = () => {
    state.active = true;
    surface.classList.add("is-armed");
    startLoop();
  };

  const disarm = () => {
    state.active = false;
    surface.classList.remove("is-armed");
    startLoop();
  };

  const reset = ({ keepVisible = false } = {}) => {
    state.locked = false;

    if (!keepVisible) {
      disarm();
    }

    setRevealCenter(surface);
    const rect = surface.getBoundingClientRect();
    state.targetX = rect.width / 2;
    state.targetY = rect.height / 2;
    state.currentX = rect.width / 2;
    state.currentY = rect.height / 2;
  };

  const handlePointerEnter = (event) => {
    updatePosition(event.clientX, event.clientY);
    arm();
  };

  const handlePointerMove = (event) => {
    updatePosition(event.clientX, event.clientY);
    startLoop();
  };

  const handlePointerLeave = () => {
    if (state.locked || surface.matches(":focus-visible")) {
      return;
    }

    disarm();
    setRevealCenter(surface);
    const rect = surface.getBoundingClientRect();
    state.targetX = rect.width / 2;
    state.targetY = rect.height / 2;
  };

  const handleFocus = () => {
    const rect = surface.getBoundingClientRect();
    state.targetX = rect.width / 2;
    state.targetY = rect.height / 2;
    state.currentX = rect.width / 2;
    state.currentY = rect.height / 2;
    setRevealCenter(surface);
    arm();
  };

  const handleBlur = () => {
    if (state.locked) {
      return;
    }

    disarm();
  };

  const handleClick = (event) => {
    if (!coarsePointer || !allowTapLock) {
      return;
    }

    if (!state.locked) {
      event.preventDefault();
      state.locked = true;
      updatePosition(event.clientX, event.clientY);
      arm();
      return;
    }

    state.locked = false;

    if (!lockOnPrimaryAction) {
      reset();
    }
  };

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(() => {
        if (!state.active && !state.locked) {
          reset();
        }
      })
    : null;

  surface.addEventListener("pointerenter", handlePointerEnter);
  surface.addEventListener("pointermove", handlePointerMove);
  surface.addEventListener("pointerleave", handlePointerLeave);
  surface.addEventListener("focus", handleFocus);
  surface.addEventListener("blur", handleBlur);
  surface.addEventListener("click", handleClick);

  resizeObserver?.observe(surface);
  reset({ keepVisible: true });

  if (coarsePointer && allowTapLock) {
    registerCoarseReset();
    coarseSurfaces.add({
      surface,
      reset,
    });
  }

  return {
    reset,
    destroy() {
      state.active = false;
      state.running = false;
      state.locked = false;
      window.cancelAnimationFrame(state.rafId);
      resizeObserver?.disconnect();
      surface.removeEventListener("pointerenter", handlePointerEnter);
      surface.removeEventListener("pointermove", handlePointerMove);
      surface.removeEventListener("pointerleave", handlePointerLeave);
      surface.removeEventListener("focus", handleFocus);
      surface.removeEventListener("blur", handleBlur);
      surface.removeEventListener("click", handleClick);

      coarseSurfaces.forEach((entry) => {
        if (entry.surface === surface) {
          coarseSurfaces.delete(entry);
        }
      });
    },
  };
};
