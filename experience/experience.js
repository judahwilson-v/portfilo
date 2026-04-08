import { createPortfolioSound } from "../assets/js/site-audio.js";
import { createSignalCursor } from "../assets/js/site-cursor.js";
import { PROJECTS } from "./projects.js";

window.__experienceModuleReached = true;
window.dispatchEvent(new CustomEvent("experience:module-entered"));

const state = {
  previewIndex: null,
  selectedIndex: 0,
  scene: null,
  sound: null,
  cursor: null,
};

let elements;

const getElements = () => ({
  openButton: document.querySelector("#open-active-project"),
  projectList: document.querySelector("#project-list"),
  projectReadout: document.querySelector("#project-readout"),
  projectCategory: document.querySelector("#project-category"),
  projectSignalNote: document.querySelector("#project-signal-note"),
  projectTitle: document.querySelector("#project-title"),
  projectBlurb: document.querySelector("#project-blurb"),
  projectIndex: document.querySelector("#project-index"),
  projectHint: document.querySelector("#project-hint"),
  loading: document.querySelector("#experience-loading"),
  fallback: document.querySelector("#experience-fallback"),
  fallbackLinks: document.querySelector("#fallback-links"),
  renderStatus: document.querySelector("#render-status"),
  interactionHint: document.querySelector("#interaction-hint"),
  canvas: document.querySelector(".experience-canvas"),
});

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const supportsFinePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const getCurrentIndex = () => state.previewIndex ?? state.selectedIndex;
const getErrorMessage = (error) => (error instanceof Error ? error.message : String(error));

const updateReadout = (index) => {
  const project = PROJECTS[index];

  if (!project) {
    return;
  }

  elements.projectCategory.textContent = project.category;
  elements.projectTitle.textContent = project.title;
  elements.projectBlurb.textContent = project.blurb;
  elements.projectIndex.textContent = project.index;
  elements.projectReadout?.style.setProperty("--project-accent", project.accent);
  elements.projectReadout?.classList.toggle("is-previewing", state.previewIndex !== null);

  if (elements.projectSignalNote) {
    elements.projectSignalNote.textContent =
      state.previewIndex === null
        ? "Stable orbit. Mild ego."
        : "Preview live. The shiny object is winning.";
  }

  elements.projectHint.textContent =
    state.previewIndex === null
      ? "Tap the node or use the button. Nobody gets extra credit for guessing."
      : "Previewing signal. One more tap and the next tab appears.";
};

const syncProjectLinkStates = () => {
  const currentIndex = getCurrentIndex();

  elements.projectList.querySelectorAll(".project-link").forEach((link) => {
    const linkIndex = Number(link.dataset.index);
    link.classList.toggle("is-selected", linkIndex === state.selectedIndex);
    link.classList.toggle("is-previewed", linkIndex === currentIndex);
  });
};

const selectProject = (index, source = "ui") => {
  if (!PROJECTS[index]) {
    return;
  }

  state.selectedIndex = index;
  state.previewIndex = null;
  updateReadout(index);
  syncProjectLinkStates();

  if (source === "ui") {
    state.scene?.selectProject(index);
  }
};

const previewProject = (index, source = "ui") => {
  if (!PROJECTS[index]) {
    return;
  }

  state.previewIndex = index;
  updateReadout(index);
  syncProjectLinkStates();

  if (source === "ui") {
    state.scene?.setPreview(index);
  }
};

const clearPreview = (source = "ui") => {
  if (state.previewIndex === null) {
    return;
  }

  state.previewIndex = null;
  updateReadout(state.selectedIndex);
  syncProjectLinkStates();

  if (source === "ui") {
    state.scene?.clearPreview();
  }
};

const openProject = (index = getCurrentIndex()) => {
  const project = PROJECTS[index];

  if (!project) {
    return;
  }

  window.open(project.url, "_blank", "noopener,noreferrer");
};

const renderProjectList = () => {
  elements.projectList.innerHTML = PROJECTS.map(
    (project, index) => `
      <a
        class="project-link"
        data-index="${index}"
        href="${project.url}"
        target="_blank"
        rel="noreferrer"
        style="--accent-color: ${project.accent};"
        data-cursor-label="Project Signal"
        data-cursor-aside="${project.title} wants to be clicked. deeply."
        data-cursor-tone="project"
      >
        <div class="project-link-head">
          <span class="project-card-index">${project.index}</span>
          <span class="project-link-label">${project.category}</span>
        </div>
        <h3>${project.title}</h3>
        <p>${project.blurb}</p>
        <div class="project-link-foot">
          <span class="project-link-label">Launch live site</span>
          <span class="project-link-arrow">-></span>
        </div>
      </a>
    `
  ).join("");

  elements.projectList.querySelectorAll(".project-link").forEach((link) => {
    const index = Number(link.dataset.index);

    link.addEventListener("mouseenter", () => {
      state.sound?.play("nodePing", { cooldownMs: 140 });
      previewProject(index);
    });

    link.addEventListener("mouseleave", () => {
      clearPreview();
    });

    link.addEventListener("focus", () => {
      state.sound?.play("nodePing", { cooldownMs: 140 });
      previewProject(index);
    });

    link.addEventListener("blur", () => {
      queueMicrotask(() => {
        if (!elements.projectList.contains(document.activeElement)) {
          clearPreview();
        }
      });
    });

    link.addEventListener("click", () => {
      state.sound?.play("uiConfirm", { cooldownMs: 180 });
      selectProject(index);
    });
  });
};

const renderFallbackLinks = () => {
  elements.fallbackLinks.innerHTML = PROJECTS.map(
    (project) => `
      <a
        href="${project.url}"
        target="_blank"
        rel="noreferrer"
        data-cursor-label="Fallback Link"
        data-cursor-aside="${project.title}, minus the nebula theatrics."
        data-cursor-tone="project"
      >${project.title}</a>
    `
  ).join("");

  const fallbackLinks = elements.fallbackLinks.querySelectorAll("a");
  state.sound?.bindHover(fallbackLinks);
  state.sound?.bindActivate(fallbackLinks);
  state.cursor?.bindTargets(fallbackLinks);
};

const showFallback = (error) => {
  const reason = getErrorMessage(error);

  console.error("Experience scene fallback reason:", reason);
  window.__experienceDiagnostics?.push(`Scene fallback: ${reason}`, "error");

  document.body.classList.add("scene-failed", "is-ready");
  elements?.loading?.setAttribute("hidden", "hidden");

  if (elements?.fallback) {
    elements.fallback.hidden = false;
  }

  if (elements?.renderStatus) {
    elements.renderStatus.textContent = "Fallback links ready";
  }
};

const bootScene = async () => {
  try {
    window.__experienceDiagnostics?.push("Attempting dynamic import of ./scene.js.", "info");

    const { createExperienceScene, getWebGLSupport } = await import("./scene.js");
    const webglSupport = getWebGLSupport();

    if (!webglSupport.supported) {
      throw new Error(webglSupport.reason);
    }

    window.__experienceDiagnostics?.push(
      `WebGL support check passed with ${webglSupport.contextType}.`,
      "ok"
    );

    state.scene = await createExperienceScene({
      canvas: elements.canvas,
      projects: PROJECTS,
      selectedIndex: state.selectedIndex,
      onProjectPreview: (index) => {
        if (state.previewIndex !== index) {
          state.sound?.play("nodePing", { cooldownMs: 140 });
        }
        state.cursor?.setOverrideMessage({
          label: PROJECTS[index]?.title ?? "Project Signal",
          aside: "yes, click the shiny one. that is the entire point.",
          tone: "project",
        });
        previewProject(index, "scene");
      },
      onProjectLeave: () => {
        state.cursor?.clearOverrideMessage();
        clearPreview("scene");
      },
      onProjectSelect: (index) => {
        selectProject(index, "scene");
      },
      onProjectOpen: (index) => {
        state.sound?.play("uiConfirm", { cooldownMs: 180 });
        openProject(index);
      },
      onReady: (qualityLabel) => {
        elements.renderStatus.textContent = qualityLabel;
        document.body.classList.add("is-ready");
        window.__experienceDiagnostics?.push("Experience scene mounted successfully.", "ok");
      },
      onQualityChange: (label) => {
        elements.renderStatus.textContent = label;
      },
    });
  } catch (error) {
    showFallback(error);
  }
};

const initExperience = () => {
  elements = getElements();
  state.sound = createPortfolioSound({
    menuRoot: document.querySelector("[data-sound-menu]"),
    autoLoopCues: ["sceneAmbient"],
  });
  state.cursor = createSignalCursor({
    defaultLabel: "Drag Field",
    defaultAside: "careful, the nebula has opinions.",
  });

  if (!elements.openButton || !elements.projectList || !elements.canvas) {
    showFallback(new Error("Experience route failed to find the required DOM mount points."));
    return;
  }

  window.__experienceDiagnostics?.push("Required DOM mount points located.", "ok");

  renderProjectList();
  renderFallbackLinks();
  updateReadout(state.selectedIndex);
  syncProjectLinkStates();

  state.sound.bindHover(
    document.querySelectorAll(
      ".experience-back, .experience-link, .experience-button, .experience-sound-toggle, .experience-sound-choice, .cursor-toggle, .cursor-choice"
    )
  );
  state.sound.bindActivate(
    document.querySelectorAll(
      ".experience-back, .experience-link, .experience-button, .experience-sound-toggle, .experience-sound-choice, [data-sound-master-toggle], .cursor-toggle, .cursor-choice"
    )
  );
  state.cursor.bindTargets(document.querySelectorAll("[data-cursor-label], .project-link, .cursor-toggle, .cursor-choice"));

  elements.openButton.addEventListener("click", () => {
    state.sound?.play("uiConfirm", { cooldownMs: 180 });
    openProject();
  });

  elements.interactionHint.textContent = supportsFinePointer()
    ? "Move to steer. Drag to drift. Click a node to open."
    : "Tap a node to open. Scroll like a normal human.";

  if (prefersReducedMotion()) {
    elements.renderStatus.textContent = "Reduced motion enabled";
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      bootScene();
    }, { timeout: 1000 });
  } else {
    window.setTimeout(() => {
      bootScene();
    }, 120);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initExperience, { once: true });
} else {
  initExperience();
}

window.addEventListener("pagehide", () => {
  state.scene?.destroy();
  state.sound?.destroy();
  state.cursor?.destroy();
});
