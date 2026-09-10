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

function partesLima(fecha: Date) {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = fmt.formatToParts(fecha);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    // weekday: Mon, Tue...
    const wdStr = get("weekday");
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = map[wdStr] ?? new Date(fecha.toLocaleString("en-US", { timeZone: "America/Lima" })).getDay();
    const hour = parseInt(get("hour"), 10);
    const minute = parseInt(get("minute"), 10);
    const second = parseInt(get("second"), 10);
    const year = parseInt(get("year"), 10);
    const month = parseInt(get("month"), 10);
    const day = parseInt(get("day"), 10);
    return { wd, hour, minute, second, year, month, day };
}

/**
 * Determina si un instante está dentro de la jornada laboral.
 * Usa zona America/Lima explícita.
 */
export function estaEnJornada(fecha: Date, incluyeSabado: boolean): boolean {
    const { wd, hour, minute } = partesLima(fecha);
    const totalMin = hour * 60 + minute;
    if (wd >= 1 && wd <= 5) {
        return totalMin >= 9 * 60 && totalMin < 18 * 60;
    }
    if (wd === 6) {
        if (!incluyeSabado) return false;
        return totalMin >= 9 * 60 && totalMin < 13 * 60;
    }
    return false; // domingo
}

/**
 * Calcula segundos laborales entre dos instantes (America/Lima).
 * Útil para interpolación sin drift: snapshotSec - laborales(snapshotAhora, now).
 */
export function segundosLaboralesEntre(inicio: Date, fin: Date, incluyeSabado: boolean): number {
    if (fin <= inicio) return 0;
    let total = 0;
    // Iterar por día en zona Lima. Para rangos cortos (<1 día) es 1 iter.
    const tz = "America/Lima";
    // Normalizar a fecha Lima
    const cur = new Date(inicio);
    const end = new Date(fin);
    // Limitar loop a 90 días para evitar costo si snapshot muy viejo (no debería pasar, poll cada 30s)
    let guard = 0;
    while (cur < end && guard < 90) {
        const { wd, year, month, day } = partesLima(cur);
        let jornada: { start: Date; end: Date } | null = null;
        // Construir jornada en UTC a partir de partes Lima -> convertir a UTC via Date con tz offset aproximado
        // Simplificado: usar Date UTC con componentes Lima y luego ajustar con offset Lima (UTC-5 sin DST)
        // Lima no tiene DST (UTC-5 todo el año) -> podemos usar offset fijo -5h
        const offsetHoras = 5;
        if (wd >= 1 && wd <= 5) {
            const s = new Date(Date.UTC(year, month - 1, day, 9 + offsetHoras, 0, 0));
            const e = new Date(Date.UTC(year, month - 1, day, 18 + offsetHoras, 0, 0));
            jornada = { start: s, end: e };
        } else if (wd === 6 && incluyeSabado) {
            const s = new Date(Date.UTC(year, month - 1, day, 9 + offsetHoras, 0, 0));
            const e = new Date(Date.UTC(year, month - 1, day, 13 + offsetHoras, 0, 0));
            jornada = { start: s, end: e };
        }
        if (jornada) {
            const segIni = cur > jornada.start ? cur : jornada.start;
            const segFin = end < jornada.end ? end : jornada.end;
            if (segFin > segIni) total += Math.floor((segFin.getTime() - segIni.getTime()) / 1000);
        }
        // avanzar al siguiente día 00:00 Lima
        const nextDayLima = new Date(Date.UTC(year, month - 1, day + 1, offsetHoras, 0, 0));
        // si end está dentro del mismo día y jornada ya evaluada, break
        if (nextDayLima > end) break;
        cur.setTime(nextDayLima.getTime());
        guard++;
    }
    return Math.max(0, total);
}
