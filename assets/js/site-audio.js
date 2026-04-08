const STORAGE_KEY = "jvw-portfolio-sound-settings-v2";
const AUDIO_BASE_URL = new URL("../audio/", import.meta.url);
const DEFAULT_SETTINGS = Object.freeze({
  effects: false,
  ambience: false,
});

const AUDIO_CUES = Object.freeze({
  mainAmbient: {
    file: "ambient-main-loop.mp3",
    group: "ambience",
    loop: true,
    volume: 0.34,
  },
  sceneAmbient: {
    file: "ambient-experience-loop.mp3",
    group: "ambience",
    loop: true,
    volume: 0.32,
  },
  sectionShift: {
    file: "transition-scene-swell.mp3",
    group: "effects",
    volume: 0.5,
  },
  uiHover: {
    file: "ui-hover-tick.mp3",
    group: "effects",
    volume: 0.3,
  },
  uiConfirm: {
    file: "ui-open-confirm.mp3",
    group: "effects",
    volume: 0.42,
  },
  nodePing: {
    file: "experience-node-ping.mp3",
    group: "effects",
    volume: 0.4,
  },
});

const readStoredState = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      effects: parsed.effects === true,
      ambience: parsed.ambience === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const writeStoredState = (settings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures and keep the current page session working.
  }
};

const toElements = (target) => {
  if (!target) {
    return [];
  }

  if (target instanceof Element) {
    return [target];
  }

  return Array.from(target).filter((element) => element instanceof Element);
};

const getStatusLabel = (settings) => {
  if (settings.effects && settings.ambience) {
    return "FX + Theme";
  }

  if (settings.effects) {
    return "FX Only";
  }

  if (settings.ambience) {
    return "Theme Only";
  }

  return "Muted";
};

const hasAnySoundEnabled = (settings) => settings.effects || settings.ambience;

const getMasterLabel = (settings) => {
  if (settings.effects && settings.ambience) {
    return "On";
  }

  if (!settings.effects && !settings.ambience) {
    return "Off";
  }

  return "Custom";
};

class PortfolioSoundController {
  constructor({ menuRoot, autoLoopCues = [] } = {}) {
    this.menuRoot = menuRoot ?? null;
    this.autoLoopCues = new Set(autoLoopCues);
    this.settings = readStoredState();
    this.unlocked = false;
    this.loopElements = new Map();
    this.cooldowns = new Map();

    this.summary = this.menuRoot?.querySelector("[data-sound-summary]") ?? null;
    this.statusNode = this.menuRoot?.querySelector("[data-sound-status]") ?? null;
    this.settingChoices = new Map();
    this.masterToggleButtons = Array.from(document.querySelectorAll("[data-sound-master-toggle]"));
    this.masterStatusNodes = Array.from(document.querySelectorAll("[data-sound-master-status]"));

    this.handleFirstGesture = this.handleFirstGesture.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleDocumentPointerDown = this.handleDocumentPointerDown.bind(this);
    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);

    this.bindMenu();
    this.armUnlockListeners();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  bindMenu() {
    this.masterToggleButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        this.unlock();
        this.toggleAll();
      });
    });

    if (!this.menuRoot) {
      this.syncMenu();
      return;
    }

    this.menuRoot.querySelectorAll("[data-sound-setting][data-sound-value]").forEach((button) => {
      const group = button.getAttribute("data-sound-setting");
      const value = button.getAttribute("data-sound-value") === "true";

      if (!group) {
        return;
      }

      const groupButtons = this.settingChoices.get(group) ?? [];
      groupButtons.push(button);
      this.settingChoices.set(group, groupButtons);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.unlock();
        this.setGroupEnabled(group, value);
      });
    });

    this.summary?.addEventListener("click", () => {
      this.unlock();
    });

    document.addEventListener("pointerdown", this.handleDocumentPointerDown);
    document.addEventListener("keydown", this.handleDocumentKeydown);
    this.syncMenu();
  }

  armUnlockListeners() {
    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      window.addEventListener(eventName, this.handleFirstGesture, {
        capture: true,
        passive: true,
      });
    });
  }

  disarmUnlockListeners() {
    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      window.removeEventListener(eventName, this.handleFirstGesture, {
        capture: true,
      });
    });
  }

  handleFirstGesture() {
    this.unlock();
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.pauseLoops();
      return;
    }

    this.syncLoops();
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

  unlock() {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    this.disarmUnlockListeners();
    this.syncLoops();
  }

  toggleAll() {
    this.setAllEnabled(!hasAnySoundEnabled(this.settings));
  }

  setAllEnabled(nextState) {
    const enabled = Boolean(nextState);

    this.settings.effects = enabled;
    this.settings.ambience = enabled;
    writeStoredState(this.settings);
    this.syncMenu();
    this.syncLoops();
  }

  setGroupEnabled(group, nextState) {
    if (!(group in DEFAULT_SETTINGS)) {
      return;
    }

    this.settings[group] = Boolean(nextState);
    writeStoredState(this.settings);
    this.syncMenu();
    this.syncLoops();
  }

  syncMenu() {
    const statusLabel = getStatusLabel(this.settings);
    const masterLabel = getMasterLabel(this.settings);
    const anySoundEnabled = hasAnySoundEnabled(this.settings);

    this.masterStatusNodes.forEach((node) => {
      node.textContent = masterLabel;
    });

    this.masterToggleButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(anySoundEnabled));
      button.dataset.soundMasterState = masterLabel.toLowerCase();
    });

    if (this.menuRoot) {
      this.menuRoot.dataset.soundState = statusLabel.toLowerCase().replace(/\s+\+\s+|\s+/g, "-");

      if (this.statusNode) {
        this.statusNode.textContent = statusLabel;
      }

      this.settingChoices.forEach((buttons, group) => {
        const enabled = Boolean(this.settings[group]);

        buttons.forEach((button) => {
          const buttonValue = button.getAttribute("data-sound-value") === "true";
          const isActive = buttonValue === enabled;

          button.setAttribute("aria-pressed", String(isActive));
          button.dataset.active = isActive ? "true" : "false";
        });
      });
    }
  }

  ensureLoopElement(name) {
    if (this.loopElements.has(name)) {
      return this.loopElements.get(name);
    }

    const cue = AUDIO_CUES[name];

    if (!cue || !cue.loop) {
      return null;
    }

    const audio = new Audio(new URL(cue.file, AUDIO_BASE_URL).href);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = cue.volume;
    audio.playsInline = true;
    audio.addEventListener("error", () => {
      this.loopElements.delete(name);
    });
    this.loopElements.set(name, audio);
    return audio;
  }

  syncLoops() {
    const canPlayAmbience = this.unlocked && !document.hidden && this.settings.ambience;

    this.autoLoopCues.forEach((name) => {
      const audio = this.ensureLoopElement(name);

      if (!audio) {
        return;
      }

      if (!canPlayAmbience) {
        audio.pause();
        return;
      }

      audio.volume = AUDIO_CUES[name].volume;

      if (!audio.paused) {
        return;
      }

      audio.play().catch(() => {
        // Missing files or autoplay failures should not break the page.
      });
    });
  }

  pauseLoops() {
    this.loopElements.forEach((audio) => {
      audio.pause();
    });
  }

  play(name, { cooldownMs = 0 } = {}) {
    const cue = AUDIO_CUES[name];

    if (!cue || cue.loop || !this.unlocked || !this.settings[cue.group]) {
      return;
    }

    const now = performance.now();
    const nextAllowedTime = this.cooldowns.get(name) ?? 0;

    if (now < nextAllowedTime) {
      return;
    }

    this.cooldowns.set(name, now + cooldownMs);

    const audio = new Audio(new URL(cue.file, AUDIO_BASE_URL).href);
    audio.preload = "auto";
    audio.volume = cue.volume;
    audio.playsInline = true;
    audio.play().catch(() => {
      // Missing files or autoplay failures should not break the page.
    });
  }

  bindHover(target, cueName = "uiHover", cooldownMs = 120) {
    toElements(target).forEach((element) => {
      element.addEventListener("pointerenter", () => {
        this.play(cueName, { cooldownMs });
      });
      element.addEventListener("focus", () => {
        this.play(cueName, { cooldownMs });
      });
    });
  }

  bindActivate(target, cueName = "uiConfirm", cooldownMs = 180) {
    toElements(target).forEach((element) => {
      element.addEventListener("click", () => {
        this.unlock();
        this.play(cueName, { cooldownMs });
      });
    });
  }

  destroy() {
    this.disarmUnlockListeners();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown);
    document.removeEventListener("keydown", this.handleDocumentKeydown);
    this.pauseLoops();
    this.loopElements.clear();
  }
}

export const createPortfolioSound = (options) => new PortfolioSoundController(options);
