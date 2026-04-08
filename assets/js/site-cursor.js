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

class SignalCursor {
  constructor({
    defaultLabel = "Move Gently",
    defaultAside = "the page already has enough drama",
    defaultTone = "default",
  } = {}) {
    this.enabled = supportsSignalCursor();

    if (!this.enabled) {
      return;
    }

    this.defaultMessage = {
      label: defaultLabel,
      aside: defaultAside,
      tone: defaultTone,
    };
    this.overrideMessage = null;
    this.currentTarget = null;
    this.pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      visible: false,
    };

    this.render = this.render.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);

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

    document.body.append(this.element);
    document.documentElement.classList.add("has-signal-cursor");
    this.refreshMessage();

    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    window.addEventListener("pointerleave", this.handlePointerLeave);

    this.frameId = window.requestAnimationFrame(this.render);
  }

  handlePointerMove(event) {
    this.pointer.visible = true;
    this.pointer.targetX = event.clientX;
    this.pointer.targetY = event.clientY;
    this.element.classList.add("is-visible");
  }

  handlePointerDown() {
    this.element.classList.add("is-pressed");
  }

  handlePointerUp() {
    this.element.classList.remove("is-pressed");
  }

  handlePointerLeave() {
    this.pointer.visible = false;
    this.element.classList.remove("is-visible");
  }

  render() {
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
    const message = this.overrideMessage ?? this.getMessageFromTarget(this.currentTarget);

    this.labelNode.textContent = message.label;
    this.asideNode.textContent = message.aside;
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
    if (!this.enabled) {
      return;
    }

    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointerleave", this.handlePointerLeave);
    window.cancelAnimationFrame(this.frameId);
    this.currentTarget?.classList.remove("is-cursor-target");
    this.element.remove();
    document.documentElement.classList.remove("has-signal-cursor");
  }
}

export const createSignalCursor = (options) => new SignalCursor(options);
