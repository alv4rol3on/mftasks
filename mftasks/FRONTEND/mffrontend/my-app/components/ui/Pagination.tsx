"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  const delta = 1;
  // generar rango con ellipsis
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const start = (page - 1) * (pageSize ?? 10) + 1;
  const end = Math.min(page * (pageSize ?? 10), totalItems ?? page * (pageSize ?? 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: page <= 1 ? "var(--color-disabled)" : "var(--color-background)",
            color: page <= 1 ? "var(--color-text-secondary)" : "var(--color-text)",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ‹ Anterior
        </button>

        {pages.map((p, idx) =>
          typeof p === "string" ? (
            <span key={`ellipsis-${idx}`} style={{ padding: "6px 4px", color: "var(--color-text-secondary)", fontSize: 13 }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-label={`Ir a página ${p}`}
              aria-current={p === page ? "page" : undefined}
              style={{
                minWidth: 36,
                padding: "6px 10px",
                borderRadius: 8,
                border: p === page ? "1px solid var(--color-brand)" : "1px solid var(--color-border)",
                background: p === page ? "var(--color-brand)" : "var(--color-background)",
                color: p === page ? "var(--color-background)" : "var(--color-text)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: p === page ? 700 : 500,
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: page >= totalPages ? "var(--color-disabled)" : "var(--color-background)",
            color: page >= totalPages ? "var(--color-text-secondary)" : "var(--color-text)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Siguiente ›
        </button>
      </div>
      {typeof totalItems === "number" && typeof pageSize === "number" && (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>
          Mostrando {start}-{end} de {totalItems} · Página {page} de {totalPages}
        </div>
      )}
    </div>
  );
}
