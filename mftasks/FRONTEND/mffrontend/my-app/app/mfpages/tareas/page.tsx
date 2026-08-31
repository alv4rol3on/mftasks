"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo } from "@/lib/types";

export default function TareasPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const [empezandoId, setEmpezandoId] = useState<number | null>(null);
  const [completandoId, setCompletandoId] = useState<number | null>(null);
  const { showToast } = useToast();
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Task | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);

  // Guard: CLIENTE puro no debe entrar a Tareas en desarrollo
  useEffect(() => {
    const user = getUsuarioActual();
    if (!user) { router.replace("/"); return; }
    const roles = (user.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.includes("administrador");
    const isCliente = roles.includes("cliente");
    const isMiembro = roles.includes("miembro");
    if (isAdmin) return;
    // Si es cliente sin rol miembro -> verificar si es lider/miembro de equipo
    if (isCliente && !isMiembro) {
      // verificar si es lider/miembro -> si lo es, permitir (cliente-miembro)
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = user.id;
          const esMiembro = arr.some((eq) => eq.lider?.id === uid || eq.miembros?.some((m) => m.id_usuario === uid));
          if (!esMiembro) setSinPermiso(true);
        })
        .catch(() => setSinPermiso(true));
    }
  }, [router]);

  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback((searchOverride?: string) => {
    const q = typeof searchOverride === "string" ? searchOverride : busqueda;
    const url = q.trim() ? `/api/tasks/tasks/?search=${encodeURIComponent(q.trim())}` : "/api/tasks/tasks/";
    apiFetch<Task[]>(url)
      .then((data) => {
        setError(null);
        // No filtrar por estado aquí; se filtra en tareasFiltradas para incluir STAND_BY y ticket
        setTareas(data);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const iniciar = async (
    tarea: Task,
    payload: {
      fecha_inicio: string;
      fecha_entrega_aproximada: string;
      subtareas: { descripcion: string; asignado: number; peso: number }[];
    }
  ) => {
    setAccionando(tarea.id);
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/iniciar/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Tarea iniciada correctamente", "success");
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      showToast(msg, "error");
    } finally {
      setAccionando(null);
    }
  };

  const empezarSubtarea = async (
    tareaId: number,
    subtareaId: number
  ) => {
    setEmpezandoId(subtareaId);

    try {
      await apiFetch(
        `/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/empezar/`,
        {
          method: "POST",
        }
      );

      showToast("Subtarea iniciada", "success");

      await cargar();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setEmpezandoId(null);
    }
  };

  const completarSubtarea = async (tareaId: number, subtareaId: number) => {
    setCompletandoId(subtareaId);

    try {
      await apiFetch(
        `/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/completar/`,
        {
          method: "POST",
        }
      );

      showToast("Subtarea completada", "success");

      await cargar();

      // Cerrar el popup
      //setTareaSeleccionada(null);

    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setCompletandoId(null);
    }
  };

  const cambiarEstadoSubtarea = async (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => {
    // obtener estado actual para decidir endpoint correcto
    const tareaActual = tareas.find((t) => t.id === tareaId);
    const subActual = tareaActual?.subtareas.find((s) => s.id === subtareaId);
    const estadoActual = subActual?.estado;

    try {
      if (nuevoEstado === "STAND_BY") {
        if (!motivo) { showToast("Motivo obligatorio para STAND_BY", "error"); return; }
        // solo desde EN_ESPERA o EN_DESARROLLO
        if (estadoActual !== "EN_ESPERA" && estadoActual !== "EN_DESARROLLO") {
          showToast(`No se puede pausar desde ${estadoActual}`, "error");
          return;
        }
        await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/standby/`, { method: "POST", body: JSON.stringify({ motivo }) });
        showToast("Subtarea en pausa", "success");
      } else if (nuevoEstado === "EN_DESARROLLO") {
        if (estadoActual === "EN_ESPERA") {
          // iniciar
          await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/empezar/`, { method: "POST" });
          showToast("Subtarea iniciada", "success");
        } else if (estadoActual === "STAND_BY") {
          await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reanudar/`, { method: "POST" });
          showToast("Subtarea reanudada", "success");
        } else {
          showToast(`Transición no válida ${estadoActual} -> ${nuevoEstado}`, "error");
          return;
        }
      } else if (nuevoEstado === "EN_ESPERA") {
        if (estadoActual === "STAND_BY") {
          await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reanudar/`, { method: "POST" });
          showToast("Subtarea reanudada a En espera", "success");
        } else {
          showToast("No se puede volver a En espera", "error");
          return;
        }
      } else if (nuevoEstado === "SOLUCIONADO") {
        if (estadoActual === "SOLUCIONADO") {
          showToast("Ya está solucionada", "error");
          return;
        }
        await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/completar/`, { method: "POST" });
        showToast("Subtarea solucionada", "success");
      }
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE no tienes acceso a Tareas en desarrollo. Usa &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes.</p>
      </div>
    );
  }

  if (cargando) {
    return <div>Cargando tareas…</div>;
  }

  if (error) {
    return <div>Error al cargar las tareas: {error}</div>;
  }

  // Filtro: por defecto últimos 3 días, STAND_BY visible, SOLUCIONADO >3 días oculto, buscador ignora fecha
  const tareasFiltradas = (() => {
    const q = busqueda.trim().toLowerCase();
    const ahora = new Date();
    const tresDiasAtras = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000);
    return tareas.filter((t) => {
      // buscador por ticket o nombre
      if (q) {
        const ticket = (t.ticket ?? "").toLowerCase();
        const asunto = (t.asunto ?? "").toLowerCase();
        if (!ticket.includes(q) && !asunto.includes(q)) return false;
        // con búsqueda, mostrar aunque sea SOLUCIONADO antiguo
        return true;
      }
      // sin búsqueda: ocultar SOLUCIONADO >3 días
      if (t.estado === "SOLUCIONADO") {
        const fechaSol = t.fecha_solucion ? new Date(t.fecha_solucion) : t.fecha_creacion ? new Date(t.fecha_creacion) : null;
        if (fechaSol && fechaSol < tresDiasAtras) return false;
        // si no tiene fecha_solucion, usar fecha_creacion como fallback
      }
      // por defecto últimos 3 días: si tarea creada hace >3 días y no está en SOLUCIONADO reciente, ocultar (pero STAND_BY/EN_DESARROLLO recientes deben mostrar)
      // Mostrar APROBADO/EN_DESARROLLO/STAND_BY sin límite de fecha, solo SOLUCIONADO aplica 3 días; EN_ESPERA no aparece aquí
      // Para cumplir "últimos 3 días" pero sin ocultar trabajo en curso, mostramos todo excepto SOLUCIONADO antiguo
      if (t.estado === "SOLUCIONADO") return true; // ya filtrado arriba, si no oculto es reciente
      // Para no ocultar STAND_BY/EN_DESARROLLO antiguos, los mostramos (el usuario dijo que desaparecía STAND_BY y no debe)
      return true;
    });
  })();

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    cargar(busqueda);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:16}}>
        <h2 className="text-lg font-medium" style={{ margin:0}}>
          Tareas en desarrollo
        </h2>
        <form onSubmit={handleBuscar} style={{ display:"flex", gap:8, alignItems:"center"}}>
          <input
            value={busqueda}
            onChange={(e)=> setBusqueda(e.target.value)}
            placeholder="Buscar por ticket o nombre..."
            style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 12px", fontSize:13, minWidth:240}}
          />
          <button type="submit" style={{ background:"#111827", color:"white", border:"none", padding:"8px 14px", borderRadius:8, cursor:"pointer", fontSize:13}}>Buscar</button>
          {busqueda && <button type="button" onClick={()=> { setBusqueda(""); cargar(""); }} style={{ background:"white", border:"1px solid #d1d5db", padding:"8px 12px", borderRadius:8, cursor:"pointer", fontSize:13}}>Limpiar</button>}
        </form>
      </div>
      <p style={{ fontSize:12, color:"#6b7280", marginTop:-8, marginBottom:12}}>Por defecto se muestran tareas en proceso o con solución reciente (≤3 días). Usa el buscador para ver anteriores por ticket o nombre.</p>

      <TaskTableEnDesarrollo
        tareas={tareasFiltradas}
        accionando={accionando}
        empezandoId={empezandoId}
        completandoId={completandoId}
        onIniciar={iniciar}
        onEmpezarSubtarea={empezarSubtarea}
        onCompletarSubtarea={completarSubtarea}
        onCambiarEstadoSubtarea={cambiarEstadoSubtarea}
      />
    </div>
  );
}