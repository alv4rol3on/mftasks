"use client";

type Prioridad = "BAJA" | "MEDIA" | "ALTA" | "URGENTE" | string | null | undefined;

const ETIQUETAS: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const ESTILOS: Record<string, { color: string; background: string; border: string }> = {
  BAJA: {
    color: "var(--color-text-secondary)",
    background: "var(--color-surface)",
    border: "var(--color-border)",
  },
  MEDIA: {
    color: "var(--color-in-progress)",
    background: "color-mix(in srgb, var(--color-in-progress) 12%, var(--color-background))",
    border: "color-mix(in srgb, var(--color-in-progress) 28%, var(--color-background))",
  },
  ALTA: {
    color: "var(--color-waiting)",
    background: "color-mix(in srgb, var(--color-waiting) 12%, var(--color-background))",
    border: "color-mix(in srgb, var(--color-waiting) 28%, var(--color-background))",
  },
  URGENTE: {
    color: "var(--color-danger)",
    background: "color-mix(in srgb, var(--color-danger) 12%, var(--color-background))",
    border: "color-mix(in srgb, var(--color-danger) 28%, var(--color-background))",
  },
};

export default function PrioridadBadge({
  prioridad,
  compact = false,
}: {
  prioridad: Prioridad;
  compact?: boolean;
}) {
  const valor = String(prioridad ?? "MEDIA").toUpperCase();
  const estilo = ESTILOS[valor] ?? ESTILOS.MEDIA;

  return (
    <span
      title={`Prioridad ${ETIQUETAS[valor] ?? valor}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "2px 6px" : "3px 8px",
        borderRadius: 999,
        border: `1px solid ${estilo.border}`,
        background: estilo.background,
        color: estilo.color,
        fontSize: compact ? 10 : 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {ETIQUETAS[valor] ?? valor}
    </span>
  );
}

export const PRIORIDAD_ORDEN: Record<string, number> = {
  URGENTE: 4,
  ALTA: 3,
  MEDIA: 2,
  BAJA: 1,
};
