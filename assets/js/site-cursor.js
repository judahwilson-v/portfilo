const STORAGE_KEY = "lake-cursor-enabled";

const supportsFineHoverPointer = () =>
  window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;

const prefersMobileViewport = () =>
  window.matchMedia("(max-width: 980px)").matches;

const usesCoarsePointer = () =>
  window.matchMedia("(any-hover: none), (any-pointer: coarse)").matches;

const supportsSignalCursor = () =>
  supportsFineHoverPointer() && !prefersMobileViewport() && !usesCoarsePointer();

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const toElements = (target) => {
  if (!target) {
    return [];
  }

  if (target instanceof Element) {
    return [target];
  }

  return Array.from(target).filter((element) => element instanceof Element);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const readStoredState = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
};

const writeStoredState = (enabled) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage errors should not break pointer interaction.
  }
};

class SignalCursor {
  constructor({
    defaultLabel = "Move Gently",
    defaultAside = "the page already has enough drama",
    defaultMode = "default",
    defaultTone = "default",
  } = {}) {
    this.supported = supportsSignalCursor() && !prefersReducedMotion();
    this.enabled = this.supported && readStoredState();
    this.defaultMessage = {
      label: defaultLabel,
      aside: defaultAside,
      mode: defaultMode,
      tone: defaultTone,
    };
    this.manualOverrideMessage = null;
    this.interactionOverrideMessage = null;
    this.currentTarget = null;
    this.boundToggles = new Map();
    this.boundTargets = new Map();
    this.magneticElements = new Set();
    this.magneticStates = new Map();
    this.hoverVisits = new WeakMap();
    this.holdTimer = 0;
    this.frameId = 0;
    this.pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      visible: false,
    };

    if (!this.supported) {
      return;
    }

    this.render = this.render.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.requestRender = this.requestRender.bind(this);
    this.updateCopyPlacement = this.updateCopyPlacement.bind(this);

    this.element = document.createElement("div");
    this.element.className = "signal-cursor";
    this.element.setAttribute("aria-hidden", "true");
    this.element.innerHTML = `
      <span class="signal-cursor-ring"></span>
      <span class="signal-cursor-core"></span>
      <div class="signal-cursor-copy">
        <span class="signal-cursor-label"></span>
        <span class="signal-cursor-aside"></span>
      </div>
    `;

    this.labelNode = this.element.querySelector(".signal-cursor-label");
    this.asideNode = this.element.querySelector(".signal-cursor-aside");
    this.element.dataset.edgeX = "right";
    this.element.dataset.edgeY = "bottom";

    document.body.append(this.element);
    this.refreshMessage();
    this.syncEnabledState();

    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    window.addEventListener("pointerleave", this.handlePointerLeave);
  }

  requestRender() {
    if (!this.supported || !this.enabled || this.frameId) {
      return;
    }

    this.frameId = window.requestAnimationFrame(this.render);
  }

  handlePointerMove(event) {
    if (!this.enabled) {
      return;
    }

    this.pointer.visible = true;
    this.pointer.targetX = event.clientX;
    this.pointer.targetY = event.clientY;
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.updateCopyPlacement(event.clientX, event.clientY);
    this.element.style.transform = `translate3d(${this.pointer.x}px, ${this.pointer.y}px, 0)`;
    this.element.classList.add("is-visible");
  }

  handlePointerDown() {
    if (!this.enabled) {
      return;
    }

    this.element.classList.add("is-pressed");
    this.clearHoldTimer();
    this.applyInteractionMessage(this.currentTarget, "press");
  }

  handlePointerUp() {
    if (!this.supported) {
      return;
    }

    this.element.classList.remove("is-pressed");
    this.clearInteractionOverride();

    if (this.currentTarget) {
      this.scheduleHoldMessage(this.currentTarget);
    }
  }

  handlePointerLeave() {
    if (!this.supported) {
      return;
    }

    this.pointer.visible = false;
    this.element.dataset.edgeX = "right";
    this.element.dataset.edgeY = "bottom";
    this.element.classList.remove("is-visible");
  }

  updateCopyPlacement(x, y) {
    if (!this.supported) {
      return;
    }

    const horizontalAllowance = Math.min(Math.max(window.innerWidth * 0.28, 280), 420);
    const verticalAllowance = Math.min(Math.max(window.innerHeight * 0.24, 170), 260);

    this.element.dataset.edgeX = x > window.innerWidth - horizontalAllowance ? "left" : "right";
    this.element.dataset.edgeY = y > window.innerHeight - verticalAllowance ? "top" : "bottom";
  }

  render() {
    if (!this.supported) {
      return;
    }

    this.frameId = 0;
    this.pointer.x = this.pointer.targetX;
    this.pointer.y = this.pointer.targetY;
    this.element.style.transform = `translate3d(${this.pointer.x}px, ${this.pointer.y}px, 0)`;

    if (this.updateMagneticElements()) {
      this.requestRender();
    }
  }

  ensureMagneticState(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    const existing = this.magneticStates.get(element);

    if (existing) {
      existing.maxTravel = Math.max(
        4,
        Number.parseFloat(element.getAttribute("data-magnetic")) || 12
      );
      return existing;
    }

    const state = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      velocityX: 0,
      velocityY: 0,
      active: false,
      maxTravel: Math.max(4, Number.parseFloat(element.getAttribute("data-magnetic")) || 12),
    };

    this.magneticStates.set(element, state);
    return state;
  }

  setMagneticTarget(element, x = 0, y = 0) {
    const state = this.ensureMagneticState(element);

    if (!state) {
      return;
    }

    state.targetX = clamp(x, -state.maxTravel, state.maxTravel);
    state.targetY = clamp(y, -state.maxTravel, state.maxTravel);
    state.active = true;
    this.requestRender();
  }

  releaseMagnetic(element, immediate = false) {
    const state = this.magneticStates.get(element);

    if (!state) {
      return;
    }

    state.targetX = 0;
    state.targetY = 0;
    state.active = false;

    if (!immediate) {
      this.requestRender();
      return;
    }

    state.x = 0;
    state.y = 0;
    state.velocityX = 0;
    state.velocityY = 0;
    element.style.translate = "";
  }

  updateMagneticElements() {
    let hasActiveMotion = false;

    this.magneticStates.forEach((state, element) => {
      const dx = state.targetX - state.x;
      const dy = state.targetY - state.y;

      state.velocityX = (state.velocityX + dx * 0.35) * 0.55;
      state.velocityY = (state.velocityY + dy * 0.35) * 0.55;
      state.x += state.velocityX;
      state.y += state.velocityY;

      const hasSettled =
        !state.active &&
        Math.abs(state.x) < 0.04 &&
        Math.abs(state.y) < 0.04 &&
        Math.abs(state.velocityX) < 0.04 &&
        Math.abs(state.velocityY) < 0.04;

      if (hasSettled) {
        state.x = 0;
        state.y = 0;
        state.velocityX = 0;
        state.velocityY = 0;
        element.style.translate = "";
        return;
      }

      hasActiveMotion = true;
      element.style.translate = `${state.x.toFixed(2)}px ${state.y.toFixed(2)}px`;
    });

    return hasActiveMotion;
  }

  getMessageFromTarget(target) {
    return {
      label: target?.getAttribute("data-cursor-label") || this.defaultMessage.label,
      aside: target?.getAttribute("data-cursor-aside") || this.defaultMessage.aside,
      mode: target?.getAttribute("data-cursor-mode") || this.defaultMessage.mode,
      tone: target?.getAttribute("data-cursor-tone") || this.defaultMessage.tone,
    };
  }

  refreshMessage() {
    if (!this.supported) {
      return;
    }

    const message =
      this.manualOverrideMessage ??
      this.interactionOverrideMessage ??
      this.getMessageFromTarget(this.currentTarget);

    this.labelNode.textContent = message.label;
    this.asideNode.textContent = message.aside;
    this.element.dataset.mode = message.mode;
    this.element.dataset.tone = message.tone;
  }

  applyTarget(target) {
    if (!this.enabled || !target) {
      return;
    }

    if (this.currentTarget && this.currentTarget !== target) {
      this.currentTarget.classList.remove("is-cursor-target");
    }

    this.currentTarget = target;
    this.currentTarget.classList.add("is-cursor-target");
    this.refreshMessage();
  }

  clearTarget(target) {
    if (!this.supported) {
      return;
    }

    if (target && this.currentTarget !== target) {
      return;
    }

    this.currentTarget?.classList.remove("is-cursor-target");
    this.currentTarget = null;
    this.refreshMessage();
  }

  setOverrideMessage(message) {
    if (!this.enabled) {
      return;
    }

    this.manualOverrideMessage = {
      ...this.defaultMessage,
      ...message,
    };
    this.refreshMessage();
  }

  clearOverrideMessage() {
    if (!this.supported) {
      return;
    }

    this.manualOverrideMessage = null;
    this.refreshMessage();
  }

  clearInteractionOverride() {
    if (!this.supported) {
      return;
    }

    this.interactionOverrideMessage = null;
    this.refreshMessage();
  }

  resetMagneticElements() {
    this.magneticStates.forEach((_, element) => {
      this.releaseMagnetic(element, true);
    });
  }

  clearHoldTimer() {
    if (this.holdTimer) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = 0;
    }
  }

  getStateMessageFromTarget(target, prefix) {
    if (!target) {
      return null;
    }

    const label = target.getAttribute(`data-cursor-${prefix}-label`);
    const aside = target.getAttribute(`data-cursor-${prefix}-aside`);
    const mode = target.getAttribute(`data-cursor-${prefix}-mode`);
    const tone = target.getAttribute(`data-cursor-${prefix}-tone`);

    if (!label && !aside && !mode && !tone) {
      return null;
    }

    return {
      ...this.getMessageFromTarget(target),
      ...(label ? { label } : {}),
      ...(aside ? { aside } : {}),
      ...(mode ? { mode } : {}),
      ...(tone ? { tone } : {}),
    };
  }

  applyInteractionMessage(target, prefix) {
    if (!this.enabled) {
      return;
    }

    const message = this.getStateMessageFromTarget(target, prefix);

    if (!message) {
      return;
    }

    this.interactionOverrideMessage = message;
    this.refreshMessage();
  }

  scheduleHoldMessage(target) {
    this.clearHoldTimer();

    if (!this.enabled || !target || this.manualOverrideMessage) {
      return;
    }

    const holdMessage = this.getStateMessageFromTarget(target, "hold");

    if (!holdMessage) {
      return;
    }

    const delay = Number.parseInt(target.getAttribute("data-cursor-hold-delay") ?? "520", 10);

    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = 0;

      if (!this.enabled || this.currentTarget !== target || this.manualOverrideMessage) {
        return;
      }

      this.interactionOverrideMessage = holdMessage;
      this.refreshMessage();
    }, Number.isFinite(delay) ? delay : 520);
  }

  syncToggleNode(node) {
    if (!(node instanceof HTMLButtonElement)) {
      return;
    }

    if (!this.supported) {
      node.hidden = true;
      node.disabled = true;
      return;
    }

    const isEnabled = this.enabled;
    const labelNode = node.querySelector("[data-cursor-toggle-label]");

    node.hidden = false;
    node.disabled = false;
    node.dataset.state = isEnabled ? "on" : "off";
    node.setAttribute("aria-pressed", String(isEnabled));
    node.setAttribute("aria-label", isEnabled ? "Turn custom cursor off" : "Turn custom cursor on");

    if (labelNode) {
      labelNode.textContent = isEnabled ? "On" : "Off";
    }
  }

  syncEnabledState() {
    if (!this.supported) {
      document.documentElement.classList.remove("has-signal-cursor");
      return;
    }

    document.documentElement.classList.toggle("has-signal-cursor", this.enabled);

    if (!this.enabled) {
      this.pointer.visible = false;
      this.element.classList.remove("is-visible", "is-pressed");
      window.cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.clearHoldTimer();
      this.clearTarget();
      this.clearInteractionOverride();
      this.clearOverrideMessage();
      this.resetMagneticElements();
    }

    this.element.hidden = !this.enabled;
    this.boundToggles.forEach((_, node) => {
      this.syncToggleNode(node);
    });
  }

  setEnabled(nextState) {
    if (!this.supported) {
      return;
    }

    this.enabled = Boolean(nextState);
    writeStoredState(this.enabled);
    this.syncEnabledState();
  }

  toggle() {
    if (!this.supported) {
      return;
    }

    this.setEnabled(!this.enabled);
  }

  attachToggle(target) {
    toElements(target).forEach((element) => {
      if (!(element instanceof HTMLButtonElement) || this.boundToggles.has(element)) {
        this.syncToggleNode(element);
        return;
      }

      const handleClick = () => {
        this.toggle();
      };

      element.addEventListener("click", handleClick);
      this.boundToggles.set(element, handleClick);
      this.syncToggleNode(element);
    });
  }

  bindTargets(target) {
    toElements(target).forEach((element) => {
      if (this.boundTargets.has(element)) {
        return;
      }

      const isMagnetic = element.hasAttribute("data-magnetic");

      if (isMagnetic) {
        this.magneticElements.add(element);
        this.ensureMagneticState(element);
      }

      const resetMagnetic = () => {
        if (!isMagnetic) {
          return;
        }

        this.releaseMagnetic(element);
      };

      const handleActivate = () => {
        if (!this.enabled) {
          return;
        }

        const visitCount = (this.hoverVisits.get(element) ?? 0) + 1;
        this.hoverVisits.set(element, visitCount);
        this.applyTarget(element);
        this.clearInteractionOverride();

        if (visitCount > 1) {
          this.applyInteractionMessage(element, "repeat");
        }

        this.scheduleHoldMessage(element);
      };

      const handleDeactivate = () => {
        this.clearHoldTimer();
        resetMagnetic();
        this.clearInteractionOverride();
        this.clearTarget(element);
      };

      element.addEventListener("pointerenter", handleActivate);
      element.addEventListener("focus", handleActivate);

      element.addEventListener("pointerleave", handleDeactivate);
      element.addEventListener("blur", handleDeactivate);

      const handlers = {
        handleActivate,
        handleDeactivate,
        handlePointerMove: null,
      };

      if (!isMagnetic) {
        this.boundTargets.set(element, handlers);
        return;
      }

      handlers.handlePointerMove = (event) => {
        if (!this.enabled) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const offsetX = event.clientX - (rect.left + rect.width / 2);
        const offsetY = event.clientY - (rect.top + rect.height / 2);
        const maxTravel = Number.parseFloat(element.getAttribute("data-magnetic")) || 12;
        const x = clamp(offsetX * 0.18, -maxTravel, maxTravel);
        const y = clamp(offsetY * 0.18, -maxTravel, maxTravel);

        this.setMagneticTarget(element, x, y);
      };

      element.addEventListener("pointermove", handlers.handlePointerMove);
      this.boundTargets.set(element, handlers);
    });
  }

  destroy() {
    if (!this.supported) {
      return;
    }

    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointerleave", this.handlePointerLeave);
    window.cancelAnimationFrame(this.frameId);

    this.boundToggles.forEach((handler, node) => {
      node.removeEventListener("click", handler);
    });
    this.boundToggles.clear();

    this.boundTargets.forEach((handlers, element) => {
      element.removeEventListener("pointerenter", handlers.handleActivate);
      element.removeEventListener("focus", handlers.handleActivate);
      element.removeEventListener("pointerleave", handlers.handleDeactivate);
      element.removeEventListener("blur", handlers.handleDeactivate);

      if (handlers.handlePointerMove) {
        element.removeEventListener("pointermove", handlers.handlePointerMove);
      }
    });
    this.boundTargets.clear();

    this.clearHoldTimer();
    this.resetMagneticElements();
    this.currentTarget?.classList.remove("is-cursor-target");
    this.element.remove();
    document.documentElement.classList.remove("has-signal-cursor");
  }
}

export const createSignalCursor = (options) => new SignalCursor(options);
