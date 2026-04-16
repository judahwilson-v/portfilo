// FIX
"use client";

import { useLayoutEffect } from "react";

import { mountContactVariableHeading } from "@/components/contact-variable-heading";

export function HomePageClient() {
  useLayoutEffect(() => {
    let cancelled = false;
    let cleanup: undefined | (() => void);
    let contactHeadingCleanup = () => {};

    const boot = async () => {
      const { initHomePage } = await import("@/assets/js/home.js");

      if (cancelled) {
        return;
      }

      cleanup = initHomePage();

      if (cancelled) {
        cleanup?.();
        return;
      }

      contactHeadingCleanup = mountContactVariableHeading();
    };

    boot();

    return () => {
      cancelled = true;
      cleanup?.();
      contactHeadingCleanup();
    };
  }, []);

  return <span data-home-client-ready hidden aria-hidden="true" />;
}
