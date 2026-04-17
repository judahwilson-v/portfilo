"use client";

import { createRoot, type Root } from "react-dom/client";

export async function mountHeroDither() {
  const mountNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-hero-dither]"));

  if (!mountNodes.length) {
    return () => {};
  }

  const { HeroDitherLayer } = await import("@/components/hero-dither-layer");
  const mounts: Array<{ mountNode: HTMLElement; root: Root }> = [];

  mountNodes.forEach((mountNode) => {
    if (mountNode.dataset.heroDitherMounted === "true") {
      return;
    }

    mountNode.dataset.heroDitherMounted = "true";

    const root = createRoot(mountNode);
    root.render(<HeroDitherLayer />);
    mounts.push({ mountNode, root });
  });

  if (!mounts.length) {
    return () => {};
  }

  return () => {
    mounts.forEach(({ mountNode, root }) => {
      mountNode.dataset.heroDitherMounted = "false";
      root.unmount();
    });
  };
}
