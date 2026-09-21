export function normalizarNombre(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + costo
      );
    }
    prev = curr;
  }

  return prev[b.length];
}

export function similitud(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export interface OpcionNombre {
  id: number;
  nombre: string;
  codigo?: string;
  activo?: boolean;
}

/**
 * Devuelve candidatos cuyo nombre normalizado contiene/está contenido en el
 * texto, o cuya similitud supera el umbral. Excluye la coincidencia exacta.
 */
export function nombresSimilares<T extends OpcionNombre>(
  texto: string,
  candidatos: T[],
  umbral = 0.6,
  max = 5
): T[] {
  const objetivo = normalizarNombre(texto);
  if (objetivo.length < 2) return [];

  const puntuados = candidatos
    .map((c) => {
      const nombre = normalizarNombre(c.nombre);
      const contiene = nombre.includes(objetivo) || objetivo.includes(nombre);
      const score = similitud(objetivo, nombre);
      return { c, nombre, contiene, score };
    })
    .filter(
      (x) => x.nombre !== objetivo && (x.contiene || x.score >= umbral)
    )
    .sort((x, y) => y.score - x.score);

  return puntuados.slice(0, max).map((x) => x.c);
}

export function existeNombreNormalizado<T extends OpcionNombre>(
  texto: string,
  candidatos: T[]
): T | undefined {
  const objetivo = normalizarNombre(texto);
  if (!objetivo) return undefined;
  return candidatos.find((c) => normalizarNombre(c.nombre) === objetivo);
}
