const STORAGE_KEY = "jvw-portfolio-cursor-settings-v1";
const DEFAULT_MODE = "signal";
const CURSOR_MODES = Object.freeze({
  signal: "Signal",
  radar: "Radar",
  dot: "Dot",
  halo: "Halo",
  native: "Native",
});

const supportsSignalCursor = () =>
  window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;

const toElements = (target) => {
  if (!target) {
    return [];
  }

  if (target instanceof Element) {
    return [target];
  }

  return Array.from(target).filter((element) => element instanceof Element);
};

const readStoredMode = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed.mode in CURSOR_MODES ? parsed.mode : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

const writeStoredMode = (mode) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode }));
  } catch {
    // Ignore storage failures and keep the current page session working.
  }
};

class SignalCursor {
  constructor({
    defaultLabel = "Move Gently",
    defaultAside = "the page already has enough drama",
    defaultTone = "default",
    menuRoot = document.querySelector("[data-cursor-menu]"),
  } = {}) {
    this.supported = supportsSignalCursor();
    this.mode = readStoredMode();
    this.menuRoot = menuRoot ?? null;
    this.summary = this.menuRoot?.querySelector("[data-cursor-summary]") ?? null;
    this.statusNodes = Array.from(document.querySelectorAll("[data-cursor-status]"));
    this.optionButtons = new Map();
    this.currentTarget = null;
    this.overrideMessage = null;
    this.element = null;
    this.frameId = null;
    this.pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      visible: false,
    };
    this.defaultMessage = {
      label: defaultLabel,
      aside: defaultAside,
      tone: defaultTone,
    };

    this.render = this.render.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleDocumentPointerDown = this.handleDocumentPointerDown.bind(this);
    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);

    this.bindMenu();
    this.syncMenu();
    this.syncMountState();
  }

  get enabled() {
    return this.supported && this.mode !== "native";
  }

  bindMenu() {
    if (!this.menuRoot) {
      return;
    }

    this.menuRoot.querySelectorAll("[data-cursor-mode]").forEach((button) => {
      const mode = button.getAttribute("data-cursor-mode");

      if (!mode || !(mode in CURSOR_MODES)) {
        return;
      }

      const buttons = this.optionButtons.get(mode) ?? [];
      buttons.push(button);
      this.optionButtons.set(mode, buttons);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.setMode(mode);
      });
    });

    document.addEventListener("pointerdown", this.handleDocumentPointerDown);
    document.addEventListener("keydown", this.handleDocumentKeydown);
  }

  handleDocumentPointerDown(event) {
    if (!this.menuRoot?.open) {
      return;
    }

    if (this.menuRoot.contains(event.target)) {
      return;
    }

    this.menuRoot.open = false;
  }

  handleDocumentKeydown(event) {
    if (event.key !== "Escape" || !this.menuRoot?.open) {
      return;
    }

    this.menuRoot.open = false;
    this.summary?.focus();
  }

  createElement() {
    if (this.element) {
      return;
    }

    this.element = document.createElement("div");
    this.element.className = "signal-cursor";
    this.element.setAttribute("aria-hidden", "true");
    this.element.innerHTML = `
      <span class="signal-cursor-aura"></span>
      <span class="signal-cursor-ring"></span>
      <span class="signal-cursor-core"></span>
      <div class="signal-cursor-copy">
        <span class="signal-cursor-label"></span>
        <span class="signal-cursor-aside"></span>
      </div>
    `;

    this.labelNode = this.element.querySelector(".signal-cursor-label");
    this.asideNode = this.element.querySelector(".signal-cursor-aside");

    document.body.append(this.element);
    document.documentElement.classList.add("has-signal-cursor");

    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    window.addEventListener("pointerleave", this.handlePointerLeave);

    this.refreshMessage();
    this.frameId = window.requestAnimationFrame(this.render);
  }

  removeElement() {
    if (!this.element) {
      return;
    }

    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointerleave", this.handlePointerLeave);
    window.cancelAnimationFrame(this.frameId);

    this.currentTarget?.classList.remove("is-cursor-target");
    this.currentTarget = null;
    this.frameId = null;
    this.pointer.visible = false;
    this.element.remove();
    this.element = null;
    this.labelNode = null;
    this.asideNode = null;
    document.documentElement.classList.remove("has-signal-cursor");
  }

  syncMountState() {
    if (this.enabled) {
      this.createElement();
      this.refreshMessage();
      return;
    }

    this.removeElement();
  }

  setMode(mode) {
    if (!(mode in CURSOR_MODES) || this.mode === mode) {
      return;
    }

    this.mode = mode;
    writeStoredMode(mode);

    if (this.menuRoot) {
      this.menuRoot.open = false;
    }

    this.syncMenu();
    this.syncMountState();
  }

  syncMenu() {
    const label = CURSOR_MODES[this.mode] ?? CURSOR_MODES[DEFAULT_MODE];

    if (this.menuRoot) {
      this.menuRoot.hidden = !this.supported;
      this.menuRoot.dataset.cursorMode = this.mode;
    }

    this.statusNodes.forEach((node) => {
      node.textContent = label;
    });

    this.optionButtons.forEach((buttons, mode) => {
      const isActive = mode === this.mode;

      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(isActive));
        button.dataset.active = isActive ? "true" : "false";
      });
    });
  }

  handlePointerMove(event) {
    if (!this.element) {
      return;
    }

    this.pointer.visible = true;
    this.pointer.targetX = event.clientX;
    this.pointer.targetY = event.clientY;
    this.element.classList.add("is-visible");
  }

  handlePointerDown() {
    this.element?.classList.add("is-pressed");
  }

  handlePointerUp() {
    this.element?.classList.remove("is-pressed");
  }

  handlePointerLeave() {
    if (!this.element) {
      return;
    }

    this.pointer.visible = false;
    this.element.classList.remove("is-visible");
  }

  render() {
    if (!this.element) {
      return;
    }

    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.22;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.22;
    this.element.style.transform = `translate3d(${this.pointer.x}px, ${this.pointer.y}px, 0)`;
    this.frameId = window.requestAnimationFrame(this.render);
  }

  getMessageFromTarget(target) {
    return {
      label: target?.getAttribute("data-cursor-label") || this.defaultMessage.label,
      aside: target?.getAttribute("data-cursor-aside") || this.defaultMessage.aside,
      tone: target?.getAttribute("data-cursor-tone") || this.defaultMessage.tone,
    };
  }

  refreshMessage() {
    if (!this.element || !this.labelNode || !this.asideNode) {
      return;
    }

    const message = this.overrideMessage ?? this.getMessageFromTarget(this.currentTarget);

    this.labelNode.textContent = message.label;
    this.asideNode.textContent = message.aside;
    this.element.dataset.tone = message.tone;
    this.element.dataset.style = this.mode;
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
    if (!this.enabled) {
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

    this.overrideMessage = message;
    this.refreshMessage();
  }

  clearOverrideMessage() {
    if (!this.enabled) {
      return;
    }

    this.overrideMessage = null;
    this.refreshMessage();
  }

  bindTargets(target) {
    toElements(target).forEach((element) => {
      element.addEventListener("pointerenter", () => {
        this.applyTarget(element);
      });

      element.addEventListener("pointerleave", () => {
        this.clearTarget(element);
      });

      element.addEventListener("focus", () => {
        this.applyTarget(element);
      });

      element.addEventListener("blur", () => {
        this.clearTarget(element);
      });
    });
  }

  destroy() {
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown);
    document.removeEventListener("keydown", this.handleDocumentKeydown);
    this.removeElement();
  }
}

export const createSignalCursor = (options) => new SignalCursor(options);
