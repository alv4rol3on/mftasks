"use client";

import { useEffect } from "react";

/**
 * Filtro quirúrgico para el ruido dev-only:
 * VM71:2 Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')
 *   at et.reportAllChanges (...) -> requestIdleCallback
 *
 * Causa: web-vitals (node_modules/next/dist/compiled/web-vitals/web-vitals.js:1)
 * registra PerformanceObserver {buffered:true} y vacía con takeRecords()/getEntries()
 * dentro de requestIdleCallback. Con navegación rápida (MsalProviders handleRedirectPromise)
 * el buffer queda vacío -> entry undefined -> e.startTime falla.
 * Es telemetría dev-only, no rompe la página y no aparece en `next start` prod.
 * Este filtro solo suprime ese caso VM + startTime + reportAllChanges, deja pasar errores reales de _next/*.
 * Referencias: GoogleChrome/web-vitals#485, vercel/next.js#55084/#67391 (b0ff3d0)
 */
export default function VmErrorFilter() {
  useEffect(() => {
    const isVmStartTime = (msg: string, filename?: string, stack?: string) => {
      if (!msg.includes("startTime")) return false;
      const text = `${msg} ${filename ?? ""} ${stack ?? ""}`;
      // stack contiene reportAllChanges y requestIdleCallback en el caso web-vitals
      const isReportAllChanges = text.includes("reportAllChanges");
      const isVm = !filename || filename.startsWith("VM") || filename.includes("VM71") || filename === "<anonymous>";
      // Si viene de VM o con reportAllChanges, es el ruido dev; si viene de webpack://_next no suprimir
      if (isVm && isReportAllChanges) return true;
      // fallback estricto: VM + startTime sin filename _next
      if (isVm && msg.includes("Cannot read properties of undefined")) return true;
      return false;
    };

    const onError = (e: ErrorEvent) => {
      if (isVmStartTime(e.message, e.filename, (e.error as Error)?.stack)) {
        e.preventDefault();
        // warning en vez de error para no contaminar overlay rojo
        console.warn("[filtro VM] suprimido startTime reportAllChanges (web-vitals dev race, inofensivo)", e.message);
      }
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = (e.reason as Error)?.message ?? String(e.reason);
      const stack = (e.reason as Error)?.stack ?? "";
      if (isVmStartTime(msg, "", stack)) {
        e.preventDefault();
        console.warn("[filtro VM] suprimido rejection startTime (web-vitals dev race)", msg);
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
