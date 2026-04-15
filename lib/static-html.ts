import { readFileSync } from "node:fs";
import { join } from "node:path";

const bodyPattern = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
const jsonLdPattern =
  /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const htmlFiles = {
  home: join(process.cwd(), "legacy-html/index.html"),
  education: join(process.cwd(), "legacy-html/education/index.html"),
  trajectory: join(process.cwd(), "legacy-html/trajectory/index.html"),
  experience: join(process.cwd(), "legacy-html/experience/index.html"),
} as const;

const cssFiles = {
  home: join(process.cwd(), "home.css"),
  secondary: join(process.cwd(), "assets/secondary-pages.css"),
  experience: join(process.cwd(), "experience/experience.css"),
} as const;

type HtmlFileKey = keyof typeof htmlFiles;
type CssFileKey = keyof typeof cssFiles;

const readHtmlFile = (key: HtmlFileKey) => readFileSync(htmlFiles[key], "utf8");
const readCssFile = (key: CssFileKey) => readFileSync(cssFiles[key], "utf8");

const extractBody = (html: string) => {
  const match = html.match(bodyPattern);

  if (!match) {
    throw new Error(`Missing <body> in ${html.slice(0, 80)}`);
  }

  return match[1];
};

const stripScripts = (html: string) => html.replace(/<script\b[\s\S]*?<\/script>/gi, "");

const normalizeLinks = (html: string) =>
  html.replace(/href="\.\.\/index\.html"/g, 'href="/"');

export const getBodyHtml = (key: HtmlFileKey) =>
  normalizeLinks(stripScripts(extractBody(readHtmlFile(key)))).trim();

export const getJsonLdBlocks = (key: HtmlFileKey) => {
  const html = readHtmlFile(key);
  const matches = Array.from(html.matchAll(jsonLdPattern));

  return matches.map((match) => match[1].trim());
};

export const getCssText = (key: CssFileKey) => readCssFile(key);
