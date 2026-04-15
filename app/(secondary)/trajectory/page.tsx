import type { Metadata } from "next";

import { RouteRuntime } from "@/components/route-runtime";
import { StructuredData } from "@/components/structured-data";
import { getBodyHtml, getCssText, getJsonLdBlocks } from "@/lib/static-html";

export const metadata: Metadata = {
  title: "Trajectory | Judah Vijai Wilson",
  description:
    "Follow Judah Vijai Wilson's trajectory through leadership roles, cybersecurity responsibility, and self-driven development since 2022.",
  alternates: {
    canonical: "/trajectory/",
  },
  openGraph: {
    locale: "en_IN",
    type: "website",
    siteName: "Judah Vijai Wilson",
    title: "Trajectory | Judah Vijai Wilson",
    description:
      "Follow Judah Vijai Wilson's trajectory through leadership roles, cybersecurity responsibility, and self-driven development since 2022.",
    url: "/trajectory/",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trajectory | Judah Vijai Wilson",
    description:
      "Follow Judah Vijai Wilson's trajectory through leadership roles, cybersecurity responsibility, and self-driven development since 2022.",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
};

export default function TrajectoryPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.dataset.route='secondary';",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: getCssText("secondary") }} />
      <StructuredData blocks={getJsonLdBlocks("trajectory")} />
      <RouteRuntime page="secondary" />
      <div dangerouslySetInnerHTML={{ __html: getBodyHtml("trajectory") }} />
    </>
  );
}
