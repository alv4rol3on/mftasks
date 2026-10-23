"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { contieneHtml, resolveMediaUrlsInHtml } from "@/lib/richText";
import styles from "./RichTextView.module.css";

type Props = {
  html: string | null | undefined;
  className?: string;
  emptyLabel?: string;
};

export default function RichTextView({
  html,
  className = "",
  emptyLabel = "Sin descripción.",
}: Props) {
  const esHtml = contieneHtml(html);

  const contenidoSeguro = useMemo(() => {
    if (!esHtml || !html) return "";

    const conUrls = resolveMediaUrlsInHtml(html);

    if (typeof window === "undefined" || typeof DOMPurify.sanitize !== "function") {
      return conUrls;
    }

    return DOMPurify.sanitize(conUrls, {
      ADD_ATTR: ["target", "rel"],
    });
  }, [esHtml, html]);

  if (!html || !html.trim()) {
    return <div className={className}>{emptyLabel}</div>;
  }

  if (!esHtml) {
    return (
      <div className={`${styles.plain} ${className}`.trim()}>
        {html}
      </div>
    );
  }

  return (
    <div
      className={`${styles.rich} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: contenidoSeguro }}
    />
  );
}
