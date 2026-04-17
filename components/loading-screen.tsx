"use client";

import { useEffect, useState, useRef } from "react";

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const duration = 2200;
      const raw = Math.min(elapsed / duration, 1);
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - raw, 3);
      setProgress(Math.round(eased * 100));

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Begin exit
        setExiting(true);
        setTimeout(() => setVisible(false), 720);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        className={`loading-screen ${exiting ? "loading-screen--exit" : ""}`}
        aria-label="Loading"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="loading-content">
          <div className="loading-brand">JVW</div>

          <div className="loading-bar-track">
            <div
              className="loading-bar-fill"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>

          <div className="loading-percent">{progress}</div>
        </div>
      </div>

      <style jsx>{`
        .loading-screen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: #000;
          opacity: 1;
          transition: opacity 680ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity;
        }

        .loading-screen--exit {
          opacity: 0;
          pointer-events: none;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2.4rem;
          width: min(80vw, 18rem);
        }

        .loading-brand {
          font-family: "Syne", sans-serif;
          font-size: clamp(1.1rem, 2.5vw, 1.4rem);
          font-weight: 800;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(244, 241, 235, 0.72);
          animation: loading-brand-pulse 2.4s ease-in-out infinite;
        }

        .loading-bar-track {
          width: 100%;
          height: 1px;
          background: rgba(244, 241, 235, 0.08);
          overflow: hidden;
          border-radius: 1px;
        }

        .loading-bar-fill {
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255, 31, 31, 0.6) 0%,
            rgba(255, 80, 80, 0.9) 50%,
            rgba(255, 31, 31, 0.6) 100%
          );
          transform-origin: left center;
          transition: transform 120ms linear;
          box-shadow: 0 0 12px rgba(255, 31, 31, 0.3);
        }

        .loading-percent {
          font-family: "Space Grotesk", sans-serif;
          font-size: 0.62rem;
          font-weight: 400;
          letter-spacing: 0.28em;
          color: rgba(244, 241, 235, 0.28);
          font-variant-numeric: tabular-nums;
        }

        @keyframes loading-brand-pulse {
          0%,
          100% {
            opacity: 0.72;
          }
          50% {
            opacity: 0.38;
          }
        }
      `}</style>
    </>
  );
}
