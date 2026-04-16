// FIX
"use client";

import type { CSSProperties } from "react";

export function Hero() {
  return (
    <div className="contact-panel premium-hero-shell">
      {/* // ENTRY ANIMATION */}
      <h2
        className="contact-title premium-hero-title"
        data-masked-heading
        data-masked-heading-unit="char"
        data-masked-heading-behavior="once"
        style={
          {
            "--heading-reveal-duration": "920ms",
            "--heading-reveal-stagger": "30ms",
          } as CSSProperties
        }
        data-variable-proximity
        data-variable-proximity-radius="210"
        data-variable-proximity-falloff="gaussian"
        data-variable-proximity-from="'wght' 430"
        data-variable-proximity-to="'wght' 820"
      >
        I make websites feel alive without making them confusing.
      </h2>

      <p className="contact-subtitle">
        Mostly portfolio sites, experiments, and product UI where motion actually helps instead of
        just showing off.
      </p>
      <p className="contact-hint">
        Move across the headline and the letters pull weight toward your cursor.
      </p>

      {/* // STYLING */}
      <style jsx>{`
        .premium-hero-shell {
          position: relative;
          isolation: isolate;
        }

        .premium-hero-title {
          position: relative;
          display: inline-block;
          max-width: 14ch;
          color: rgba(244, 241, 235, 0.96);
          -webkit-text-fill-color: currentColor;
          text-shadow:
            0 0 18px rgba(244, 241, 235, 0.08),
            0 0 42px rgba(244, 241, 235, 0.05);
          transform-origin: left center;
          transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }

        .premium-hero-shell:hover .premium-hero-title,
        .premium-hero-shell:focus-within .premium-hero-title {
          transform: scale(1.04);
        }

        .premium-hero-title :global(.heading-mask-word) {
          padding-block: 0.1em 0.14em;
          margin-block: -0.1em -0.14em;
        }

        .premium-hero-title :global(.heading-mask-token) {
          color: rgba(244, 241, 235, 0.96);
          -webkit-text-fill-color: currentColor;
          text-shadow:
            0 0 12px rgba(244, 241, 235, 0.08),
            0 0 32px rgba(244, 241, 235, 0.05);
          transition:
            transform var(--heading-reveal-duration) cubic-bezier(0.22, 1, 0.36, 1),
            opacity 620ms ease,
            font-variation-settings 150ms cubic-bezier(0.22, 1, 0.36, 1),
            font-weight 150ms cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
    </div>
  );
}
