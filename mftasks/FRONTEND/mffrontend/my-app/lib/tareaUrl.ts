
export function crearSegmentoTarea(asunto: string, id: number): string {
  const slug = asunto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "solicitud"}-${id}`;
}

export function obtenerTareaId(segmento: string): number | null {
  const coincidencia = segmento.match(/(?:^|-)(\d+)$/);

  if (!coincidencia) return null;

  const id = Number(coincidencia[1]);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
