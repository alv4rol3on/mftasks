"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";

interface TareaConPendientes {
  tarea_id: number;
  asunto: string;
  equipo_nombre: string;
  estado_tarea: string;
  subtareas: { subtarea_id: number; descripcion: string; estado: string; peso: number }[];
}
interface Resumen {
  tipo: "asignador" | "asistente" | "admin" | "cliente";
  por_aprobar?: number;
  pendientes?: number;
  tareas_pendientes?: number;
  tareas_con_pendientes?: TareaConPendientes[];
  en_espera?: number;
  aprobadas?: number;
  en_desarrollo?: number;
  rechazadas?: number;
  solucionadas?: number;
  total?: number;
}

export default function Home() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Resumen>("/api/tasks/tasks/resumen/")
      .then((data) => setResumen(data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div>Cargando alertas…</div>;
  if (error) return <div className="rounded p-4 text-sm text-red-600">Error al cargar alertas: {error}</div>;

  const esAsignador = resumen?.tipo === "asignador" || resumen?.tipo === "admin";
  const esCliente = resumen?.tipo === "cliente";
  const porAprobar = resumen?.por_aprobar ?? 0;
  const pendientes = resumen?.pendientes ?? 0;

  // Determinar si es asistente puro para mensaje
  const usuario = getUsuarioActual();
  const roles = (usuario?.roles ?? []).map((r) => r.toLowerCase());
  const esAdmin = roles.includes("administrador");

  if (esCliente) {
    const total = resumen?.total ?? 0;
    return (
      <div>
        <h2 className="mb-5 text-sm font-medium">Alertas:</h2>
        {total === 0 ? (
          <div className="rounded p-4 text-sm">No tienes solicitudes aún. Crea tu primera solicitud.</div>
        ) : (
          <div className="grid gap-3">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ background: "#fef3c7", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>En espera: {resumen?.en_espera ?? 0}</span>
              <span style={{ background: "#dcfce7", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>Aprobadas: {resumen?.aprobadas ?? 0}</span>
              <span style={{ background: "#dbeafe", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>En desarrollo: {resumen?.en_desarrollo ?? 0}</span>
              <span style={{ background: "#fee2e2", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>Rechazadas: {resumen?.rechazadas ?? 0}</span>
              <span style={{ background: "#e0e7ff", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>Solucionadas: {resumen?.solucionadas ?? 0}</span>
            </div>
            <Link href="/mfpages/cliente/mis-solicitudes" style={{ color: "#2563eb", textDecoration: "underline", fontSize: 14 }}>
              Ver mis solicitudes →
            </Link>
          </div>
        )}
      </div>
    );
  }

  const tareasConPendientes = resumen?.tareas_con_pendientes ?? [];

  const renderPendientesDetalle = () => {
    if (tareasConPendientes.length === 0) return null;
    return (
      <div style={{ marginTop: 12, background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 700, color: "#374151" }}>
          Estás teniendo subtareas pendientes por completar en:
        </div>
        {tareasConPendientes.map((t) => (
          <div key={t.tarea_id} style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              Tarea #{t.tarea_id} — {t.asunto} <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 12 }}>({t.equipo_nombre} • {t.estado_tarea})</span>
            </div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#374151" }}>
              {t.subtareas.map((s) => (
                <li key={s.subtarea_id} style={{ marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{s.descripcion}</span> — <span style={{ background: s.estado === "EN_DESARROLLO" ? "#fef3c7" : "#e5e7eb", padding: "1px 6px", borderRadius: 999, fontSize: 11 }}>{s.estado}</span> (peso {s.peso})
                </li>
              ))}
            </ul>
            <Link href="/mfpages/tareas" style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline" }}>Ver tarea →</Link>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h2 className="mb-5 text-sm font-medium">Alertas:</h2>

      {esAsignador ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {porAprobar > 0 ? (
            <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 16 }}>
              <p style={{ color: "#92400e", fontWeight: 600 }}>
                Tienes {porAprobar} {porAprobar === 1 ? "tarea por aprobar" : "tareas por aprobar"}
              </p>
              <Link href="/mfpages/solicitudes" style={{ color: "#b45309", textDecoration: "underline", fontSize: 14 }}>
                Ir a centro de solicitudes →
              </Link>
            </div>
          ) : (
            <div className="rounded p-4 text-sm" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>No hay tareas por aprobar.</div>
          )}
          {pendientes > 0 && (
            <div style={{ background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 8, padding: 16 }}>
              <p style={{ color: "#1e40af", fontWeight: 600 }}>
                Tienes {pendientes} {pendientes === 1 ? "subtarea pendiente" : "subtareas pendientes"}
                {resumen?.tareas_pendientes ? ` en ${resumen.tareas_pendientes} tarea(s)` : ""}
              </p>
              <Link href="/mfpages/tareas" style={{ color: "#1d4ed8", textDecoration: "underline", fontSize: 14 }}>
                Ver mis tareas →
              </Link>
            </div>
          )}
          {pendientes > 0 && renderPendientesDetalle()}
          {pendientes === 0 && porAprobar === 0 && <div className="rounded p-4 text-sm text-white-600">No hay alertas pendientes.</div>}
        </div>
      ) : pendientes > 0 ? (
        <div>
          <div style={{ background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 8, padding: 16 }}>
            <p style={{ color: "#1e40af", fontWeight: 600 }}>
              Tienes {pendientes} {pendientes === 1 ? "subtarea pendiente" : "subtareas pendientes"}
              {resumen?.tareas_pendientes ? ` en ${resumen.tareas_pendientes} tarea(s)` : ""}
            </p>
            <Link href="/mfpages/tareas" style={{ color: "#1d4ed8", textDecoration: "underline", fontSize: 14 }}>
              Ver mis tareas →
            </Link>
          </div>
          {renderPendientesDetalle()}
        </div>
      ) : (
        <div className="rounded p-4 text-sm text-white-600">No hay alertas pendientes.</div>
      )}

      {esAdmin && resumen?.tipo === "admin" && (
        <div className="mt-4 space-y-2">
          {porAprobar > 0 && (
            <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 12, fontSize: 13 }}>
              Admin: {porAprobar} tareas por aprobar
            </div>
          )}
          {pendientes > 0 && (
            <div style={{ background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 8, padding: 12, fontSize: 13 }}>
              Admin: {pendientes} subtareas asignadas pendientes
            </div>
          )}
          {pendientes > 0 && renderPendientesDetalle()}
        </div>
      )}
    </div>
  );
}
