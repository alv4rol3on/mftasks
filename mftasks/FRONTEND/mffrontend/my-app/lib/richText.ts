import { apiBaseUrl } from "./authConfig";

const HTML_TAG_RE = /<\s*[a-zA-Z][^>]*>/;

export function contieneHtml(valor: string | null | undefined): boolean {
  return Boolean(valor && HTML_TAG_RE.test(valor));
}

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";

  if (url.startsWith("/media/")) {
    return `${apiBaseUrl}${url}`;
  }

  return url;
}

export function resolveMediaUrlsInHtml(html: string | null | undefined): string {
  if (!html) return "";

  const base = apiBaseUrl.replace(/\/+$/, "");

  if (!base) return html;

  return html.replace(
    /(src|href)=(["'])\/media\//gi,
    (_match, atributo: string, comilla: string) =>
      `${atributo}=${comilla}${base}/media/`
  );
}

export function normalizeMediaUrls(html: string): string {
  if (!html) return "";

  const base = apiBaseUrl.replace(/\/+$/, "");

  if (!base) return html;

  return html.split(`${base}/media/`).join("/media/");
}

export function stripHtml(valor: string | null | undefined): string {
  if (!valor) return "";

  const conSeparadores = valor
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote|pre|tr|td|th)\s*>/gi, " ");

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return conSeparadores
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const doc = new DOMParser().parseFromString(conSeparadores, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function tieneContenido(valor: string | null | undefined): boolean {
  return stripHtml(valor).length > 0;
}
