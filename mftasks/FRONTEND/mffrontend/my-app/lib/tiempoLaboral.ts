/**
 * Utilidades de horario laboral en cliente (America/Lima).
 * L-V 09:00-18:00, Sábado 09:00-13:00 si incluye_sabado, Domingo no laboral.
 * Usado para congelar el tick fuera de jornada y para formateo.
 */

export function formatearTiempo(totalSegundos: number): string {
    const segundos = Math.max(0, Math.floor(totalSegundos));
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segundosRestantes = segundos % 60;
    return `${dias}d ${String(horas).padStart(2, "0")}h ${String(minutos).padStart(2, "0")}m ${String(segundosRestantes).padStart(2, "0")}s`;
}

/**
 * Determina si un instante está dentro de la jornada laboral.
 * Usa zona America/Lima explícita.
 */
export function estaEnJornada(fecha: Date, incluyeSabado: boolean): boolean {
    // Convertir a America/Lima: usamos Intl para extraer partes
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Lima",
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).formatToParts(fecha);

    // weekday mapping: Sun=0 ... Sat=6 via getUTCDay fallback usando Intl día
    // Más simple: crear fecha en Lima via locale string
    const limaStr = fecha.toLocaleString("en-US", { timeZone: "America/Lima" });
    const limaDate = new Date(limaStr);
    const wd = limaDate.getDay(); // 0 Dom, 6 Sab
    const hour = limaDate.getHours();
    const minute = limaDate.getMinutes();
    const totalMin = hour * 60 + minute;

    if (wd >= 1 && wd <= 5) {
        // L-V (lunes=1 ... viernes=5)
        return totalMin >= 9 * 60 && totalMin < 18 * 60;
    }
    if (wd === 6) {
        if (!incluyeSabado) return false;
        return totalMin >= 9 * 60 && totalMin < 13 * 60;
    }
    return false; // domingo
}
