// FIX
"use client";

import { useLayoutEffect } from "react";

import { mountContactVariableHeading } from "@/components/contact-variable-heading";

export function HomePageClient() {
  useLayoutEffect(() => {
    let cancelled = false;
    let cleanup: undefined | (() => void);
    let contactHeadingCleanup = () => {};
    let heroDitherCleanup = () => {};

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

      const { mountHeroDither } = await import("@/components/hero-dither-dom");
      heroDitherCleanup = await mountHeroDither();

      if (cancelled) {
        heroDitherCleanup();
        cleanup?.();
        return;
      }

      contactHeadingCleanup = mountContactVariableHeading();
    };

    boot();

    return () => {
      cancelled = true;
      cleanup?.();
      heroDitherCleanup();
      contactHeadingCleanup();
    };
  }, []);

  return <span data-home-client-ready hidden aria-hidden="true" />;
}
