import type { Metadata } from "next";

import { Projects2DView } from "@/components/projects-2d-view";

export const metadata: Metadata = {
  title: "Projects 2D | Judah Vijai Wilson",
  description:
    "Browse Judah Vijai Wilson's projects in a 2D stacked view with scroll-linked cards, project notes, and live links.",
  alternates: {
    canonical: "/experience/2d/",
  },
  openGraph: {
    locale: "en_IN",
    type: "website",
    siteName: "Judah Vijai Wilson",
    title: "Projects 2D | Judah Vijai Wilson",
    description:
      "Browse Judah Vijai Wilson's projects in a 2D stacked view with scroll-linked cards, project notes, and live links.",
    url: "/experience/2d/",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Projects 2D | Judah Vijai Wilson",
    description:
      "Browse Judah Vijai Wilson's projects in a 2D stacked view with scroll-linked cards, project notes, and live links.",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
};

export default function Experience2DPage() {
  return <Projects2DView />;
}
