"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import ScrollStack, { ScrollStackItem } from "@/components/ScrollStack";
import { PROJECTS } from "@/experience/projects.js";

import styles from "./projects-2d-view.module.css";

type Project = {
  id: string;
  index: string;
  title: string;
  category: string;
  modeLabel?: string;
  blurb: string;
  detail?: string;
  highlights?: string[];
  url: string;
  accent: string;
  glow: string;
  ctaLabel?: string;
};

const projects = PROJECTS as Project[];

const getProjectStyle = (project: Project): CSSProperties =>
  ({
    "--project-accent": project.accent,
    "--project-glow": project.glow,
  }) as CSSProperties;

export function Projects2DView() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Projects / 2D View</p>
          <h1 className={styles.title}>Stacked proofs in flat space.</h1>
          <p className={styles.subtitle}>
            It is currently in dev. You should not be here.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/experience/" className={styles.secondaryAction}>
            Return to 3D field
          </Link>
          <a href="#project-stack" className={styles.primaryAction}>
            Enter the stack
          </a>
        </div>

        <nav className={styles.quickNav} aria-label="Project shortcuts">
          {projects.map((project) => (
            <a key={project.id} href={`#${project.id}`} className={styles.quickNavLink}>
              <span>{project.index}</span>
              <span>{project.title}</span>
            </a>
          ))}
        </nav>
      </section>

      <section className={styles.stackSection} id="project-stack">
        <div className={styles.stackHeader}>
          <div>
            <p className={styles.stackLabel}>ScrollStack</p>
            <h2 className={styles.stackTitle}>Every project now has a 2D card.</h2>
          </div>
          <p className={styles.stackHint}>
            Scroll through the page and the cards will compress into a stacked trail.
          </p>
        </div>

        <ScrollStack
          className={styles.stackScroller}
          itemDistance={108}
          itemScale={0.028}
          itemStackDistance={34}
          stackPosition="16%"
          scaleEndPosition="8%"
          baseScale={0.9}
          rotationAmount={-1.6}
          blurAmount={0.85}
          scaleDuration={0.3}
          useWindowScroll
        >
          {projects.map((project) => (
            <ScrollStackItem key={project.id} itemClassName={styles.stackItem}>
              <article id={project.id} className={styles.card} style={getProjectStyle(project)}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIndexWrap}>
                    <span className={styles.cardIndex}>{project.index}</span>
                    <span className={styles.cardMode}>{project.modeLabel ?? project.category}</span>
                  </div>
                  <p className={styles.cardCategory}>{project.category}</p>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardMain}>
                    <h3 className={styles.cardTitle}>{project.title}</h3>
                    <p className={styles.cardBlurb}>{project.blurb}</p>
                    {project.detail ? <p className={styles.cardDetail}>{project.detail}</p> : null}
                  </div>

                  {project.highlights?.length ? (
                    <ul className={styles.highlightList}>
                      {project.highlights.map((highlight) => (
                        <li key={highlight} className={styles.highlightItem}>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className={styles.cardActions}>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.cardPrimaryAction}
                  >
                    {project.ctaLabel ?? "Launch live site"}
                  </a>
                  <Link href="/experience/" className={styles.cardSecondaryAction}>
                    Back to 3D
                  </Link>
                </div>
              </article>
            </ScrollStackItem>
          ))}
        </ScrollStack>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerCopy}>
          The original 3D project field is still live. This route is just the flatter way in.
        </p>
        <Link href="/experience/" className={styles.footerLink}>
          Open 3D experience
        </Link>
      </footer>
    </main>
  );
}
