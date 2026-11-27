"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";

import type { NivelInfo } from "@/lib/types";

import styles from "./AdminSections.module.css";
import NivelModal from "./NivelModal";
import IconButton from "@/components/ui/IconButton";

type Props = {
  setMsg: (msg: string | null) => void;
};

/** Roles ordenados por profundidad (árbol), con su nivel para indentar. */
function ordenarPorArbol(
  roles: NivelInfo[]
): { rol: NivelInfo; depth: number }[] {
  const mapa = new Map(roles.map((r) => [r.id, r]));
  const hijos = new Map<number | null, NivelInfo[]>();

  for (const r of roles) {
    const key =
      r.superior != null && mapa.has(r.superior) ? r.superior : null;
    const lista = hijos.get(key) ?? [];
    lista.push(r);
    hijos.set(key, lista);
  }

  const resultado: { rol: NivelInfo; depth: number }[] = [];
  const visitados = new Set<number>();

  const recorrer = (parentId: number | null, depth: number) => {
    const lista = [...(hijos.get(parentId) ?? [])].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
    for (const r of lista) {
      if (visitados.has(r.id)) continue;
      visitados.add(r.id);
      resultado.push({ rol: r, depth });
      recorrer(r.id, depth + 1);
    }
  };

  recorrer(null, 0);

  // Roles huérfanos (ciclos/corruptos) que no se alcanzaron.
  for (const r of roles) {
    if (!visitados.has(r.id)) {
      resultado.push({ rol: r, depth: 0 });
    }
  }

  return resultado;
}

export default function NivelesSection({ setMsg }: Props) {
  const [roles, setRoles] = useState<NivelInfo[]>([]);
  const [cargando, setCargando] = useState(false);

  const [filtro, setFiltro] = useState("");

  const [rolModalOpen, setRolModalOpen] = useState(false);
  const [rolEditando, setRolEditando] = useState<NivelInfo | null>(null);

  // --------------------------------------------------
  // CARGA
  // --------------------------------------------------

  const cargarRoles = async () => {
    setCargando(true);
    try {
      const data = await apiFetch<NivelInfo[] | { results: NivelInfo[] }>(
        "/api/usuarios/niveles/"
      );
      setRoles(Array.isArray(data) ? data : data.results ?? []);
    } catch (e) {
      setRoles([]);
      setMsg(`Error cargando niveles: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRoles();
  }, []);

  // --------------------------------------------------
  // DERIVADOS
  // --------------------------------------------------

  const contarUsuarios = (nivel: NivelInfo) =>
    nivel.usuarios_count ?? 0;

  const arbol = useMemo(() => ordenarPorArbol(roles), [roles]);


  const filas = useMemo(() => {
    const q = filtro.toLowerCase().trim();

    return arbol.filter(({ rol }) => {
      if (!rol.activo) return false;

      if (!q) return true;

      return (
        rol.nombre.toLowerCase().includes(q) ||
        (rol.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [arbol, filtro]);

  // --------------------------------------------------
  // ACCIONES
  // --------------------------------------------------

  const abrirCreacion = () => {
    setRolEditando(null);
    setRolModalOpen(true);
  };

  const abrirEdicion = (rol: NivelInfo) => {
    setRolEditando(rol);
    setRolModalOpen(true);
  };

  const eliminar = async (rol: NivelInfo) => {
    const cantidad = contarUsuarios(rol);
    if (cantidad > 0) {
      setMsg("Hay usuarios con este nivel");
      return;
    }
    if (
      !confirm(
        `¿Eliminar el nivel "${rol.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/usuarios/niveles/${rol.id}/`, { method: "DELETE" });
      setMsg("Nivel eliminado");
      if (rolEditando?.id === rol.id) setRolModalOpen(false);
      await cargarRoles();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.container}>
      {/* LISTA */}

      <div className={styles.card}>
        <div className={styles.usersHeader}>
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>
            Niveles ({filas.length})
          </h3>

          <div className={styles.usersFilters}>
            <input
              placeholder="Buscar nivel o descripción..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className={styles.searchInput}
            />

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={abrirCreacion}
            >
              + Crear nivel
            </button>
          </div>
        </div>

        {cargando ? (
          <div style={{ color: "var(--color-text)", fontSize: 13 }}>Cargando...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nivel</th>
                  {/*<th>Aprobador directo</th>*/}
                  {/*<th>Cadena de aprobación</th>*/}
                  <th>Lidera</th>
                  <th>Autoaprueba</th>
                  <th>Solicita</th>
                  <th># Usuarios</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody style={{ backgroundColor: "var(--color-table-row)" }}>
                {filas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      No hay niveles que coincidan.
                    </td>
                  </tr>
                ) : (
                  filas.map(({ rol, depth }) => {
                    return (
                      <tr
                        key={rol.id}
                      >
                        <td>
                          <div
                            style={{
                              paddingLeft: depth * 18,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {depth > 0 && (
                              <span style={{ color: "var(--color-text-secondary)" }}>↳</span>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                <span
                                  aria-hidden="true"
                                  title={rol.color || "Neutro"}
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 999,
                                    flexShrink: 0,
                                    background: rol.color || "var(--color-sidebar)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                />
                                {rol.nombre}
                              </div>
                              {rol.descripcion && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--color-text-secondary)",
                                  }}
                                >
                                  {rol.descripcion}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          {rol.puede_liderar ? (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOn}`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOff}`}
                            >
                              X
                            </span>
                          )}
                        </td>


                        <td>
                          {rol.auto_aprobar ? (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOn}`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOff}`}
                            >
                              X
                            </span>
                          )}
                        </td>

                        <td>
                          {rol.puede_crear_solicitudes ? (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOn}`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOff}`}
                            >
                              X
                            </span>
                          )}
                        </td>

                        <td>{contarUsuarios(rol)}</td>

                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <IconButton
                              icon="edit"
                              variant="primary"
                              title="Editar nivel"
                              onClick={() => abrirEdicion(rol)}
                            />
                            <IconButton
                              icon="trash"
                              variant="danger"
                              title="Eliminar nivel (solo si no está en uso)"
                              onClick={() => eliminar(rol)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rolModalOpen && (
        <NivelModal
          key={rolEditando?.id ?? "nuevo"}
          nivel={rolEditando}
          onClose={() => setRolModalOpen(false)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarRoles();
          }}
        />
      )}
    </div>
  );
}
