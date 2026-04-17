"use client";

import { useEffect, useState, useRef } from "react";

import Dither from "@/components/dither/Dither";

export function HeroDitherLayer() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);

    sync();
    media.addEventListener("change", sync);

    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  // Track mouse globally so interaction works even when hero-name is on top
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    window.addEventListener("pointermove", handleMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
    };
  }, []);

  return (
    <>
      <div className="hero-dither-layer" aria-hidden="true">
        <Dither
          waveColor={[1, 0, 0]}
          disableAnimation={reduceMotion}
          enableMouseInteraction={true}
          mouseRadius={0.5}
          colorNum={2.5}
          pixelSize={3}
          waveAmplitude={0.04}
          waveFrequency={4}
          waveSpeed={0.02}
          externalMouseRef={mouseRef}
        />
      </div>

      <style jsx>{`
        .hero-dither-layer {
          width: 100%;
          height: 100%;
          pointer-events: none;
          border-radius: 2.2rem;
          opacity: 1;
          mix-blend-mode: normal;
          filter: saturate(1.45) contrast(1.28) brightness(1.15);
        }
      `}</style>
    </>
  );
}
