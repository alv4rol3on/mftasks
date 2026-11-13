import { apiFetch } from "./api";

export type HorarioLaboral = {
  id?: number;
  dia: number;
  activo: boolean;
  hora_inicio: string;
  hora_fin: string;
};

type RespuestaHorarios =
  | HorarioLaboral[]
  | { results: HorarioLaboral[] };

const PASO_MINUTOS = 30;

export const HORARIOS_DEFAULT: HorarioLaboral[] = [
  { dia: 0, activo: true, hora_inicio: "09:00", hora_fin: "18:00" },
  { dia: 1, activo: true, hora_inicio: "09:00", hora_fin: "18:00" },
  { dia: 2, activo: true, hora_inicio: "09:00", hora_fin: "18:00" },
  { dia: 3, activo: true, hora_inicio: "09:00", hora_fin: "18:00" },
  { dia: 4, activo: true, hora_inicio: "09:00", hora_fin: "18:00" },
  { dia: 5, activo: true, hora_inicio: "09:00", hora_fin: "13:00" },
  { dia: 6, activo: false, hora_inicio: "09:00", hora_fin: "13:00" },
];

function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Día de la semana del backend (0=lunes ... 6=domingo). */
export function diaSemanaDeFecha(fecha: string): number | null {
  const [year, month, day] = fecha.split("-").map(Number);

  if (!year || !month || !day) return null;

  const domingoCero = new Date(year, month - 1, day).getDay();

  return (domingoCero + 6) % 7;
}

export function horarioDeFecha(
  horarios: HorarioLaboral[],
  fecha: string
): HorarioLaboral | null {
  const dia = diaSemanaDeFecha(fecha);
  if (dia === null) return null;
  return horarios.find((h) => h.dia === dia) ?? null;
}

/** Horas válidas para una fecha, según el horario configurado. */
export function horasValidasParaFecha(
  horarios: HorarioLaboral[],
  fecha: string,
  incluirFin = false
): string[] {
  const horario = horarioDeFecha(horarios, fecha);

  if (!horario || !horario.activo) return [];

  const inicio = aMinutos(horario.hora_inicio);
  const fin = aMinutos(horario.hora_fin);

  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio >= fin) {
    return [];
  }

  const horas: string[] = [];
  const limite = incluirFin ? fin : fin - 1;

  for (let minuto = inicio; minuto <= limite; minuto += PASO_MINUTOS) {
    horas.push(aHora(minuto));
  }

  if (incluirFin && horas[horas.length - 1] !== aHora(fin)) {
    horas.push(aHora(fin));
  }

  return horas;
}

export function fechaHoraEnHorario(
  horarios: HorarioLaboral[],
  fecha: string,
  hora: string,
  incluirFin = false
): boolean {
  return horasValidasParaFecha(horarios, fecha, incluirFin).includes(hora);
}

export async function obtenerHorariosLaborales(): Promise<HorarioLaboral[]> {
  const data = await apiFetch<RespuestaHorarios>(
    "/api/tasks/horarios-laborales/"
  );

  const registros = Array.isArray(data) ? data : data.results ?? [];

  return HORARIOS_DEFAULT.map((horarioDefault) => {
    const encontrado = registros.find((h) => h.dia === horarioDefault.dia);

    if (!encontrado) return { ...horarioDefault };

    return {
      ...encontrado,
      hora_inicio: (encontrado.hora_inicio || horarioDefault.hora_inicio).slice(
        0,
        5
      ),
      hora_fin: (encontrado.hora_fin || horarioDefault.hora_fin).slice(0, 5),
    };
  }).sort((a, b) => a.dia - b.dia);
}
