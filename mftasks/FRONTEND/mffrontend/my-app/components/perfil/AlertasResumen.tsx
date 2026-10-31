"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Task } from "@/lib/types";

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

export default function AlertasResumen() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCrear, setOpenCrear] = useState(false);
  const [, setTareas] = useState<Task[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    apiFetch<Resumen>("/api/tasks/tasks/resumen/")
      .then((data) => setResumen(data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  {/*const cargar = useCallback(async () => {
    try {
      const data = await apiFetch<Task[]>("/api/tasks/tasks/");
      setTareas(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      showToast((e as Error).message, "error");
    } finally {
      setCargando(false);
    }
  }, [showToast]);*/}

  if (cargando) return <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Cargando alertas…</div>;
  if (error) return <div className="rounded p-4 text-sm text-red-600">Error al cargar alertas: {error}</div>;

  const esAsignador = resumen?.tipo === "asignador" || resumen?.tipo === "admin";
  //const esCliente = resumen?.tipo === "cliente";
  const porAprobar = resumen?.por_aprobar ?? 0;
  const pendientes = resumen?.pendientes ?? 0;
  const tareasConPendientes = resumen?.tareas_con_pendientes ?? [];

  {/*if (esCliente) {
    const total = resumen?.total ?? 0;
    return (
      <div>
        {total === 0 ? (
          <div className="rounded p-4 text-sm">No tienes solicitudes aún. Crea tu primera solicitud.</div>
        ) : (
          <div className="grid gap-3">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ background: "color-mix(in srgb, var(--color-waiting) 12%, var(--color-background))", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>En espera: {resumen?.en_espera ?? 0}</span>
              <span style={{ background: "color-mix(in srgb, var(--color-done) 12%, var(--color-background))", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>Aprobadas: {resumen?.aprobadas ?? 0}</span>
              <span style={{ background: "color-mix(in srgb, var(--color-in-progress) 12%, var(--color-background))", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>En desarrollo: {resumen?.en_desarrollo ?? 0}</span>
              <span style={{ background: "color-mix(in srgb, var(--color-danger) 10%, var(--color-background))", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>Rechazadas: {resumen?.rechazadas ?? 0}</span>
            </div>
            <Link href="/mfpages/cliente/mis-solicitudes" style={{ color: "var(--color-in-progress)", textDecoration: "underline", fontSize: 14 }}>
              Ver mis solicitudes →
            </Link>
          </div>
        )}
        <CrearSolicitudModal open={openCrear} onClose={() => setOpenCrear(false)} onCreated={() => { cargar(); }} />
      </div>
    );
  }*/}

  const renderPendientesDetalle = () => {
    if (tareasConPendientes.length === 0) return null;
    return (
      <div style={{ marginTop: 12, background: "color-mix(in srgb, var(--color-in-progress) 12%, var(--color-background))", border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--color-in-progress) 12%, var(--color-background))", borderBottom: "1px solid var(--color-border)", fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
          Estás teniendo subtareas pendientes por completar en:
        </div>
        {tareasConPendientes.map((t) => (
          <div key={t.tarea_id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
              Tarea #{t.tarea_id} — {t.asunto} <span style={{ fontWeight: 400, color: "var(--color-text-secondary)", fontSize: 12 }}>({t.equipo_nombre} • {t.estado_tarea})</span>
            </div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--color-text)" }}>
              {t.subtareas.map((s) => (
                <li key={s.subtarea_id} style={{ marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{s.descripcion}</span> — <span style={{ background: s.estado === "EN_DESARROLLO" ? "color-mix(in srgb, var(--color-waiting) 12%, var(--color-background))" : "var(--color-border)", padding: "1px 6px", borderRadius: 999, fontSize: 11 }}>{s.estado}</span> (peso {s.peso})
                </li>
              ))}
            </ul>
            <Link href="/mfpages/tareas" style={{ fontSize: 12, color: "var(--color-in-progress)", textDecoration: "underline" }}>Ver tarea →</Link>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {esAsignador ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {porAprobar > 0 ? (
            <div style={{ background: "color-mix(in srgb, var(--color-waiting) 12%, var(--color-background))", border: "1px solid var(--color-waiting)", borderRadius: 8, padding: 16 }}>
              <p style={{ color: "var(--color-waiting)", fontWeight: 600 }}>
                Tienes {porAprobar} {porAprobar === 1 ? "solicitud por aprobar" : "solicitudes por aprobar"}
              </p>
              <Link href="/mfpages/solicitudes" style={{ color: "var(--color-waiting)", textDecoration: "underline", fontSize: 14 }}>
                Ir a Bandeja de solicitudes →
              </Link>
            </div>
          ) : null}
          {pendientes > 0 && renderPendientesDetalle()}
          {pendientes === 0 && porAprobar === 0 && <div className="rounded p-4 text-sm">No hay alertas pendientes.</div>}
        </div>
      ) : pendientes > 0 ? (
        <div>{renderPendientesDetalle()}</div>
      ) : (
        <div className="rounded p-4 text-sm">No hay alertas pendientes.</div>
      )}
    </div>
  );
}
