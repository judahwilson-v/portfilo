import type { Metadata } from "next";

import { RouteRuntime } from "@/components/route-runtime";
import { StructuredData } from "@/components/structured-data";
import { getBodyHtml, getCssText, getJsonLdBlocks } from "@/lib/static-html";

export const metadata: Metadata = {
  title: "Education | Judah Vijai Wilson",
  description:
    "See Judah Vijai Wilson's education path, from ICSE results to Class 12 science and a planned ECE-to-VLSI route.",
  alternates: {
    canonical: "/education/",
  },
  openGraph: {
    locale: "en_IN",
    type: "website",
    siteName: "Judah Vijai Wilson",
    title: "Education | Judah Vijai Wilson",
    description:
      "See Judah Vijai Wilson's education path, from ICSE results to Class 12 science and a planned ECE-to-VLSI route.",
    url: "/education/",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Education | Judah Vijai Wilson",
    description:
      "See Judah Vijai Wilson's education path, from ICSE results to Class 12 science and a planned ECE-to-VLSI route.",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
};

export default function EducationPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.dataset.route='secondary';",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: getCssText("secondary") }} />
      <StructuredData blocks={getJsonLdBlocks("education")} />
      <RouteRuntime page="secondary" />
      <div dangerouslySetInnerHTML={{ __html: getBodyHtml("education") }} />
    </>
  );
}
