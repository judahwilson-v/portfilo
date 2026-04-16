"use client";

import { Fragment, useMemo } from "react";
import { createRoot } from "react-dom/client";

import VariableProximity from "@/components/VariableProximity";

const CONTACT_HEADING_LABEL = "I make websites feel alive without making them confusing.";
const CONTACT_LINE_WORD_COUNT = 3;

const splitLabelIntoLines = (label, wordsPerLine = CONTACT_LINE_WORD_COUNT) => {
  const words = label.split(" ").filter(Boolean);
  const lines = [];

  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine).join(" "));
  }

  return lines;
};

function ContactVariableHeading({ container, label }) {
  const containerRef = useMemo(() => ({ current: container }), [container]);
  const lines = useMemo(() => splitLabelIntoLines(label), [label]);

  return (
    <Fragment>
      <span className="contact-title-lines" aria-hidden="true">
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className="contact-title-line">
            <VariableProximity
              label={line}
              className="contact-title-react-bits"
              fromFontVariationSettings="'wght' 420, 'opsz' 9"
              toFontVariationSettings="'wght' 760, 'opsz' 24"
              containerRef={containerRef}
              radius={160}
              falloff="gaussian"
              showScreenReaderLabel={false}
            />
          </span>
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </Fragment>
  );
}

export function mountContactVariableHeading(root = document) {
  const headings = Array.from(root.querySelectorAll("[data-react-variable-proximity]")).filter(
    heading => heading.dataset.reactVariableProximityMounted !== "true"
  );

  if (!headings.length) {
    return () => {};
  }

  headings.forEach(heading => {
    const label = heading.textContent?.replace(/\s+/g, " ").trim() || CONTACT_HEADING_LABEL;
    heading.dataset.reactVariableProximityMounted = "true";

    const reactRoot = createRoot(heading);
    reactRoot.render(<ContactVariableHeading container={heading} label={label} />);
    heading._contactHeadingUnmount = () => {
      reactRoot.unmount();
      delete heading.dataset.reactVariableProximityMounted;
      delete heading._contactHeadingUnmount;
    };
  });

  return () => {
    headings.forEach(heading => {
      heading._contactHeadingUnmount?.();
    });
  };
}
