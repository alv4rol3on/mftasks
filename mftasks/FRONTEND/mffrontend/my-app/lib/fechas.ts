const TZ_LIMA = "America/Lima";

const fmtLima = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_LIMA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha (yyyy-mm-dd) del instante dado en zona America/Lima. */
export function fechaEnLima(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return "";
  return fmtLima.format(date);
}

/**
 * Rango por defecto del filtro de fechas: hasta = hoy (America/Lima) y
 * desde = hoy - 6 días (ventana de 7 días calendario incluyendo hoy).
 */
export function rangoFechasPorDefecto(): { desde: string; hasta: string } {
  const hasta = fmtLima.format(new Date());
  const [y, m, d] = hasta.split("-").map(Number);
  const desde = new Date(Date.UTC(y, m - 1, d - 6)).toISOString().slice(0, 10);
  return { desde, hasta };
}
