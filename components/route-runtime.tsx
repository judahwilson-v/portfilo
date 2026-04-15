// FIX
"use client";

import { useEffect, useRef } from "react";

type RouteRuntimeProps = {
  page: "home" | "secondary" | "experience";
};

export function RouteRuntime({ page }: RouteRuntimeProps) {
  const cleanupRef = useRef<undefined | (() => void)>(undefined);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      let initCleanup: undefined | (() => void);

      if (page === "home") {
        const { initHomePage } = await import("@/assets/js/home.js");
        initCleanup = initHomePage();
      } else if (page === "secondary") {
        const { initSecondaryPage } = await import("@/assets/js/secondary-pages.js");
        initCleanup = initSecondaryPage();
      } else {
        const { initExperiencePage } = await import("@/experience/experience.js");
        initCleanup = initExperiencePage();
      }

      if (cancelled) {
        initCleanup?.();
        return;
      }

      cleanupRef.current = initCleanup;
    };

    boot();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = undefined;
    };
  }, [page]);

  return null;
}
