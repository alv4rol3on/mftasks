"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import CrearSolicitudModal from "@/components/cliente/CrearSolicitudModal";
import TaskDetailClienteModal from "@/components/cliente/TaskDetailClienteModal";
import { getUsuarioActual } from "@/lib/auth";

const formatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const fmt = (f: string | null | undefined) =>
  !f
    ? "-"
    : isNaN(new Date(f).getTime())
      ? "-"
      : formatter.format(new Date(f));

const estadoColor: Record<string, string> = {
  EN_ESPERA: "#f59e0b",
  APROBADO: "#2563eb",
  EN_DESARROLLO: "#7c3aed",
  RECHAZADO: "#dc2626",
  SOLUCIONADO: "#16a34a",
  STANDBY: "#6b7280",
};

const ITEMS_POR_PAGINA = 10;

export default function MisSolicitudesPage() {
  const router = useRouter();

  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtro, setFiltro] = useState<string>("TODAS");
  const [busqueda, setBusqueda] = useState("");

  const [pagina, setPagina] = useState(1);

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

      setTareas(data);
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

  /*
   * FILTRO + BUSCADOR
   */
  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return tareas.filter((t) => {
      // Filtro por estado
      const coincideEstado =
        filtro === "TODAS" || t.estado === filtro;

      if (!coincideEstado) {
        return false;
      }

      // Sin búsqueda
      if (!texto) {
        return true;
      }

      // Campos donde se puede buscar
      return (
        String(t.id ?? "").toLowerCase().includes(texto) ||
        String(t.asunto ?? "").toLowerCase().includes(texto) ||
        String(t.cliente_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.equipo_nombre ?? "").toLowerCase().includes(texto)
      );
    });
  }, [tareas, filtro, busqueda]);

  /*
   * PAGINACIÓN
   */
  const totalPaginas = Math.max(
    1,
    Math.ceil(filtradas.length / ITEMS_POR_PAGINA)
  );

  const tareasPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;

    return filtradas.slice(
      inicio,
      inicio + ITEMS_POR_PAGINA
    );
  }, [filtradas, pagina]);

  /*
   * Si cambia el filtro o la búsqueda,
   * volver a la primera página.
   */
  useEffect(() => {
    setPagina(1);
  }, [filtro, busqueda]);

  /*
   * Si después de una actualización la página actual
   * deja de existir, regresar a la última página válida.
   */
  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

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
      {/* ENCABEZADO */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 className="text-lg font-medium">
          Mis solicitudes
        </h2>

        <button
          onClick={() => setOpenCrear(true)}
          style={{
            background: "#2563eb",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          + Nueva solicitud
        </button>
      </div>

      {/* BUSCADOR */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por ticket, asunto, cliente o equipo..."
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            minWidth: 280,
            flex: 1,
          }}
        />

        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            style={{
              background: "white",
              border: "1px solid #d1d5db",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {[
          "TODAS",
          "EN_ESPERA",
          "APROBADO",
          "EN_DESARROLLO",
          "STANDBY",
          "RECHAZADO",
          "SOLUCIONADO",
        ].map((est) => (
          <button
            key={est}
            onClick={() => setFiltro(est)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #ddd",
              background:
                filtro === est ? "#3128bb" : "white",
              color:
                filtro === est ? "white" : "#333",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {est}
          </button>
        ))}
      </div>

      {/* RESULTADOS */}
      {filtradas.length === 0 ? (
        <div
          className="rounded p-4 text-sm"
          style={{
            background: "#f9fafb",
            border: "1px dashed #ddd",
          }}
        >
          No hay solicitudes que coincidan con los filtros.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {tareasPagina.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                  background: "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t.asunto}

                      <span
                        style={{
                          background:
                            estadoColor[t.estado] ??
                            "#6b7280",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          marginLeft: 6,
                        }}
                      >
                        {t.estado}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      {t.cliente_nombre} •{" "}
                      {t.equipo_nombre} •{" "}
                      {fmt(t.fecha_creacion)}
                    </div>

                    {t.motivo_rechazo &&
                      t.estado === "RECHAZADO" && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#dc2626",
                            marginTop: 4,
                          }}
                        >
                          Motivo: {t.motivo_rechazo}
                        </div>
                      )}
                  </div>

                  <button
                    onClick={() => setSelected(t)}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 6,
                      border: "1px solid #3128bb",
                      color: "#3128bb",
                      background: "white",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Ver detalle
                  </button>
                </div>

                {(t.estado === "EN_DESARROLLO" ||
                  t.estado === "SOLUCIONADO" ||
                  t.subtareas.length > 0) && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      <span>Progreso</span>

                      <span>
                        {parseFloat(
                          String(t.progreso ?? 0)
                        ).toFixed(1)}
                        %
                      </span>
                    </div>

                    <div
                      style={{
                        background: "#e5e7eb",
                        borderRadius: 6,
                        height: 8,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            parseFloat(
                              String(t.progreso ?? 0)
                            ) || 0
                          )}%`,
                          background: "#2563eb",
                          height: "100%",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        marginTop: 4,
                      }}
                    >
                      {t.subtareas.length} subtareas •{" "}
                      {
                        t.subtareas.filter(
                          (s) =>
                            s.estado === "SOLUCIONADO"
                        ).length
                      }{" "}
                      completadas
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* PAGINACIÓN */}
          {totalPaginas > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                onClick={() =>
                  setPagina((p) => Math.max(1, p - 1))
                }
                disabled={pagina === 1}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background:
                    pagina === 1
                      ? "#f3f4f6"
                      : "white",
                  cursor:
                    pagina === 1
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ← Anterior
              </button>

              <span
                style={{
                  fontSize: 13,
                  color: "#4b5563",
                }}
              >
                Página {pagina} de {totalPaginas}
              </span>

              <button
                onClick={() =>
                  setPagina((p) =>
                    Math.min(totalPaginas, p + 1)
                  )
                }
                disabled={pagina === totalPaginas}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background:
                    pagina === totalPaginas
                      ? "#f3f4f6"
                      : "white",
                  cursor:
                    pagina === totalPaginas
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* CONTADOR */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#6b7280",
              marginTop: 8,
            }}
          >
            Mostrando{" "}
            {Math.min(
              (pagina - 1) * ITEMS_POR_PAGINA + 1,
              filtradas.length
            )}{" "}
            -{" "}
            {Math.min(
              pagina * ITEMS_POR_PAGINA,
              filtradas.length
            )}{" "}
            de {filtradas.length} solicitudes
          </div>
        </>
      )}

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

