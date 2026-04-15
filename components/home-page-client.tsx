// FIX
"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Hero } from "@/components/Hero";

export function HomePageClient() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setSlot(document.querySelector<HTMLElement>("[data-home-hero-slot]"));
  }, []);

  useEffect(() => {
    if (!slot) {
      return;
    }

    let cancelled = false;
    let cleanup: undefined | (() => void);

    const boot = async () => {
      const { initHomePage } = await import("@/assets/js/home.js");

      if (cancelled) {
        return;
      }

      cleanup = initHomePage();
    };

    boot();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [slot]);

  if (!slot) {
    return null;
  }

  return createPortal(<Hero />, slot);
}
