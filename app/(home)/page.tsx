// FIX
import type { Metadata } from "next";

import { HomePageClient } from "@/components/home-page-client";
import { LoadingScreen } from "@/components/loading-screen";
import { getBodyHtml, getCssText } from "@/lib/static-html";
import TextPressure from "@/components/TextPressure";

const contactHeadingFallbackScript = String.raw`
(() => {
  const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

  const revealHeading = (heading) => {
    if (!heading || heading.dataset.maskedHeadingPlayed === "true") {
      return;
    }

    heading.dataset.maskedHeadingPlayed = "true";
    requestAnimationFrame(() => {
      heading.classList.add("is-revealed");
    });
  };

  const splitHeading = (heading) => {
    if (!heading || heading.dataset.maskedHeadingReady === "true") {
      return;
    }

    const text = normalizeText(heading.textContent || "");

    if (!text) {
      return;
    }

    heading.dataset.maskedHeadingReady = "true";
    heading.classList.add("heading-masked-reveal");
    heading.setAttribute("aria-label", text);

    const fragment = document.createDocumentFragment();
    let itemIndex = 0;

    text.split(" ").forEach((word, wordIndex, words) => {
      const mask = document.createElement("span");
      mask.className = "heading-mask-word";
      mask.setAttribute("aria-hidden", "true");

      const inner = document.createElement("span");
      inner.className = "heading-mask-word-inner";

      Array.from(word).forEach((character) => {
        const char = document.createElement("span");
        char.className = "heading-mask-char heading-mask-token";
        char.textContent = character;
        char.style.setProperty("--item-index", String(itemIndex));
        inner.append(char);
        itemIndex += 1;
      });

      mask.append(inner);
      fragment.append(mask);

      if (wordIndex < words.length - 1) {
        fragment.append(document.createTextNode(" "));
      }
    });

    heading.textContent = "";
    heading.append(fragment);
  };

  const boot = () => {
    const heading = document.querySelector(".scene-contact [data-masked-heading]");

    if (!heading) {
      return;
    }

    splitHeading(heading);

    if (!("IntersectionObserver" in window)) {
      revealHeading(heading);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        revealHeading(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });

    observer.observe(heading);

    const rect = heading.getBoundingClientRect();
    const visible = rect.bottom > window.innerHeight * 0.12 && rect.top < window.innerHeight * 0.88;

    if (visible) {
      revealHeading(heading);
      observer.unobserve(heading);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    return;
  }

  boot();
})();
`;

const getHomePageHtml = () => {
  return getBodyHtml("home");
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
      <LoadingScreen />
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.dataset.route='home';",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: getCssText("home") }} />
      <HomePageClient />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: homeHtml }} />
      <script dangerouslySetInnerHTML={{ __html: contactHeadingFallbackScript }} />
      
      {/* ITS LOOP section */}
      <section style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', overflow: 'hidden' }}>
        <TextPressure
          text="ITS LOOP"
          flex={true}
          alpha={false}
          stroke={false}
          width={true}
          weight={true}
          italic={true}
          textColor="#ff0000"
          strokeColor="#ff2727"
          minFontSize={36}
        />
      </section>
    </>
  );
}
