import type { Metadata } from "next";

import { RouteRuntime } from "@/components/route-runtime";
import { StructuredData } from "@/components/structured-data";
import { getBodyHtml, getCssText, getJsonLdBlocks } from "@/lib/static-html";

export const metadata: Metadata = {
  title: "Projects | Judah Vijai Wilson",
  description:
    "Explore Judah Vijai Wilson's projects through a scroll-driven 3D showcase of client work, prototypes, and live builds.",
  alternates: {
    canonical: "/experience/",
  },
  openGraph: {
    locale: "en_IN",
    type: "website",
    siteName: "Judah Vijai Wilson",
    title: "Projects | Judah Vijai Wilson",
    description:
      "Explore Judah Vijai Wilson's projects through a scroll-driven 3D showcase of client work, prototypes, and live builds.",
    url: "/experience/",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Projects | Judah Vijai Wilson",
    description:
      "Explore Judah Vijai Wilson's projects through a scroll-driven 3D showcase of client work, prototypes, and live builds.",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
};

export default function ExperiencePage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.dataset.route='experience';",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: getCssText("experience") }} />
      <StructuredData blocks={getJsonLdBlocks("experience")} />
      <RouteRuntime page="experience" />
      <div dangerouslySetInnerHTML={{ __html: getBodyHtml("experience") }} />
    </>
  );
}
