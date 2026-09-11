"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import CrearSolicitudModal from "@/components/cliente/CrearSolicitudModal";
import TaskDetailClienteModal from "@/components/cliente/TaskDetailClienteModal";
import ClienteSolicitudesTable from "@/components/solicitudes/ClienteSolicitudesTable";
import { getUsuarioActual } from "@/lib/auth";

const ESTADOS = ["TODOS", "EN_ESPERA", "APROBADO", "EN_DESARROLLO", "STAND_BY", "SOLUCIONADO", "RECHAZADO"] as const;

export default function MisSolicitudesPage() {
  const router = useRouter();

  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtro, setFiltro] = useState<string>("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const [openCrear, setOpenCrear] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  const { showToast } = useToast();
  const [sinPermiso, setSinPermiso] = useState(false);

  useEffect(() => {
    const user = getUsuarioActual();

    if (!user) {
      router.replace("/");
      return;
    }

    const roles = (user.roles ?? []).map((r) => r.toLowerCase());

    const isAdmin = roles.includes("administrador");
    const isCliente = roles.includes("cliente");

    if (!isCliente && !isAdmin) {
      setSinPermiso(true);
    }
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch<Task[]>("/api/tasks/tasks/");

      // ordenar más reciente primero como admin
      const ordenadas = [...data].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
      setTareas(ordenadas);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      showToast((e as Error).message, "error");
    } finally {
      setCargando(false);
    }
  }, [showToast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return tareas.filter((t) => {
      const coincideEstado = filtro === "TODOS" || t.estado === filtro;
      if (!coincideEstado) return false;
      if (!texto) return true;
      return (
        (t.ticket ?? "").toLowerCase().includes(texto) ||
        String(t.asunto ?? "").toLowerCase().includes(texto) ||
        String(t.descripcion ?? "").toLowerCase().includes(texto) ||
        String(t.campana_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.subcampana_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.solicitante_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.equipo_nombre ?? "").toLowerCase().includes(texto)
      );
    });
  }, [tareas, filtro, busqueda]);

  if (sinPermiso) {
    return (
      <div
        style={{
          background: "#fee2e2",
          border: "1px solid #fecaca",
          padding: 16,
          borderRadius: 8,
        }}
      >
        <p style={{ color: "#991b1b", fontWeight: 600 }}>
          Acceso denegado
        </p>

        <p
          style={{
            color: "#7f1d1d",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          Esta sección es solo para CLIENTE. Si eres ASISTENTE /
          SUB-LIDER / LIDER usa &quot;Centro de solicitudes&quot; y
          &quot;Tareas en desarrollo&quot;.
        </p>
      </div>
    );
  }

  if (cargando) {
    return <div>Cargando solicitudes…</div>;
  }

  if (error) {
    return (
      <div style={{ color: "#dc2626" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      {/* ENCABEZADO - patron admin */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 className="text-lg font-medium" style={{ margin: 0 }}>Mis solicitudes</h2>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{filtradas.length} de {tareas.length} solicitudes</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={() => setOpenCrear(true)}
          style={{
            background: "#3128bb",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          + Nueva solicitud
        </button>
      </div>

      {/* FILTROS patron admin */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 160, background: "white" }}
        >
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{s === "TODOS" ? "Todos los estados" : s}</option>
          ))}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por ticket, asunto, descripción..."
          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240, flex: 1 }}
        />
        {(busqueda || filtro !== "TODOS") && (
          <button
            onClick={() => { setBusqueda(""); setFiltro("TODOS"); }}
            style={{ border: "1px solid #d1d5db", background: "white", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Limpiar
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Ordenadas de la más reciente a la más antigua. Responsive con filtros por estado y buscador. Barra de progreso solo en el detalle.</p>

      <ClienteSolicitudesTable tareas={filtradas} onSelect={setSelected} />

      <CrearSolicitudModal
        open={openCrear}
        onClose={() => setOpenCrear(false)}
        onCreated={() => {
          showToast("Solicitud creada", "success");
          cargar();
        }}
      />

      <TaskDetailClienteModal
        tarea={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
