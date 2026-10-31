export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export const EXTENSIONES_PERMITIDAS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "zip",
];

export const ACCEPT_ARCHIVOS = EXTENSIONES_PERMITIDAS.map((ext) => `.${ext}`).join(",");

export const extensionDe = (nombre: string) => {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : "";
};

export const formatearBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export function validarArchivos(
  archivos: File[],
  existentes: File[] = []
): { validos: File[]; errores: string[] } {
  const validos: File[] = [];
  const errores: string[] = [];
  let total = existentes.reduce((acc, file) => acc + file.size, 0);

  for (const archivo of archivos) {
    if (!EXTENSIONES_PERMITIDAS.includes(extensionDe(archivo.name))) {
      errores.push(`${archivo.name} (formato no permitido)`);
      continue;
    }
    const duplicado = [...existentes, ...validos].some(
      (item) =>
        item.name === archivo.name &&
        item.size === archivo.size &&
        item.lastModified === archivo.lastModified
    );
    if (duplicado) continue;
    if (total + archivo.size > MAX_TOTAL_BYTES) {
      errores.push(`${archivo.name} (supera el límite de 10 MB en total)`);
      continue;
    }
    validos.push(archivo);
    total += archivo.size;
  }

  return { validos, errores };
}
