// FIX
import type { Metadata } from "next";

import { HomePageClient } from "@/components/home-page-client";
import { getBodyHtml, getCssText } from "@/lib/static-html";

const contactPanelPattern =
  /<div class="contact-panel">[\s\S]*?<\/div>\s*(?=<div class="contact-socials">)/;

const getHomePageHtml = () => {
  const legacyHomeHtml = getBodyHtml("home");

  if (!contactPanelPattern.test(legacyHomeHtml)) {
    throw new Error("Unable to locate the homepage contact panel for Hero injection.");
  }

  return legacyHomeHtml.replace(
    contactPanelPattern,
    '<div data-home-hero-slot style="display: contents;"></div>',
  );
};

export const metadata: Metadata = {
  title: "Judah Vijai Wilson | Developer & Designer",
  description:
    "Judah Vijai Wilson is a developer and designer from Kochi building client websites, React interfaces, and clean digital experiences.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    locale: "en_IN",
    type: "website",
    siteName: "Judah Vijai Wilson",
    title: "Judah Vijai Wilson | Developer & Designer",
    description:
      "Judah Vijai Wilson is a developer and designer from Kochi building client websites, React interfaces, and clean digital experiences.",
    url: "/",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Judah Vijai Wilson | Developer & Designer",
    description:
      "Judah Vijai Wilson is a developer and designer from Kochi building client websites, React interfaces, and clean digital experiences.",
    images: [
      {
        url: "/assets/hero-portrait.jpeg",
        alt: "Portrait of Judah Vijai Wilson",
      },
    ],
  },
};

export default function HomePage() {
  const homeHtml = getHomePageHtml();

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.dataset.route='home';",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: getCssText("home") }} />
      <HomePageClient />
      <div dangerouslySetInnerHTML={{ __html: homeHtml }} />
    </>
  );
}
