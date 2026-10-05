"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";

import type { RolInfo } from "@/lib/types";

import styles from "./AdminSections.module.css";
import RolModal from "./RolModal";

type Usuario = {
  id: number;
  email: string;
  nombres: string;
  apellidos: string;
  roles?: string[];
};

type Props = {
  setMsg: (msg: string | null) => void;
};

/** Cadena de un rol: el propio rol y sus superiores directos, en orden. */
function cadenaDe(rol: RolInfo, mapa: Map<number, RolInfo>): RolInfo[] {
  const cadena: RolInfo[] = [rol];
  const vistos = new Set<number>([rol.id]);
  let actual = rol.superior;
  while (actual != null && !vistos.has(actual)) {
    const padre = mapa.get(actual);
    if (!padre) break;
    cadena.push(padre);
    vistos.add(padre.id);
    actual = padre.superior;
  }
  return cadena;
}

/** Roles ordenados por profundidad (árbol), con su nivel para indentar. */
function ordenarPorArbol(
  roles: RolInfo[]
): { rol: RolInfo; depth: number }[] {
  const mapa = new Map(roles.map((r) => [r.id, r]));
  const hijos = new Map<number | null, RolInfo[]>();

  for (const r of roles) {
    const key =
      r.superior != null && mapa.has(r.superior) ? r.superior : null;
    const lista = hijos.get(key) ?? [];
    lista.push(r);
    hijos.set(key, lista);
  }

  const resultado: { rol: RolInfo; depth: number }[] = [];
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

export default function RolesSection({ setMsg }: Props) {
  const [roles, setRoles] = useState<RolInfo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);

  const [filtro, setFiltro] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<
    "activos" | "inactivos" | "todos"
  >("todos");

  const [rolModalOpen, setRolModalOpen] = useState(false);
  const [rolEditando, setRolEditando] = useState<RolInfo | null>(null);

  // --------------------------------------------------
  // CARGA
  // --------------------------------------------------

  const cargarRoles = async () => {
    setCargando(true);
    try {
      const data = await apiFetch<RolInfo[] | { results: RolInfo[] }>(
        "/api/usuarios/roles/"
      );
      setRoles(Array.isArray(data) ? data : data.results ?? []);
    } catch (e) {
      setRoles([]);
      setMsg(`Error cargando roles: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const data = await apiFetch<Usuario[] | { results: Usuario[] }>(
        "/api/usuarios/usuarios/"
      );
      setUsuarios(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setUsuarios([]);
    }
  };

  useEffect(() => {
    cargarRoles();
    cargarUsuarios();
  }, []);

  // --------------------------------------------------
  // DERIVADOS
  // --------------------------------------------------

  const mapaRoles = useMemo(
    () => new Map(roles.map((r) => [r.id, r])),
    [roles]
  );

  const conteoPorRol = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of usuarios) {
      for (const r of u.roles ?? []) {
        const k = r.toLowerCase();
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  }, [usuarios]);

  const contarUsuarios = (nombre: string) =>
    conteoPorRol.get(nombre.toLowerCase()) ?? 0;

  const arbol = useMemo(() => ordenarPorArbol(roles), [roles]);

  const filas = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    return arbol.filter(({ rol }) => {
      if (filtroActivo === "activos" && !rol.activo) return false;
      if (filtroActivo === "inactivos" && rol.activo) return false;
      if (!q) return true;
      return (
        rol.nombre.toLowerCase().includes(q) ||
        (rol.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [arbol, filtro, filtroActivo]);

  // Opciones de superior: excluye el propio rol y sus descendientes.
  const opcionesSuperior = useMemo(() => {
    const editandoId = rolEditando?.id ?? null;
    const excluidos = new Set<number>();
    if (editandoId != null) {
      excluidos.add(editandoId);
      for (const r of roles) {
        const vistos = new Set<number>();
        let actual = r.superior;
        while (actual != null && !vistos.has(actual)) {
          if (actual === editandoId) {
            excluidos.add(r.id);
            break;
          }
          vistos.add(actual);
          actual = mapaRoles.get(actual)?.superior ?? null;
        }
      }
    }
    const opciones = roles
      .filter((r) => !excluidos.has(r.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((r) => ({
        value: String(r.id),
        label: r.nombre,
        sublabel:
          r.superior != null
            ? `depende de ${mapaRoles.get(r.superior)?.nombre ?? "?"}`
            : "raíz",
      }));
    return [{ value: "", label: "— Sin superior (raíz) —" }, ...opciones];
  }, [roles, rolEditando, mapaRoles]);

  // --------------------------------------------------
  // ACCIONES
  // --------------------------------------------------

  const abrirCreacion = () => {
    setRolEditando(null);
    setRolModalOpen(true);
  };

  const abrirEdicion = (rol: RolInfo) => {
    setRolEditando(rol);
    setRolModalOpen(true);
  };

  const eliminar = async (rol: RolInfo) => {
    if (
      !confirm(
        `¿Eliminar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/usuarios/roles/${rol.id}/`, { method: "DELETE" });
      setMsg(`Rol "${rol.nombre}" eliminado.`);
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
            Roles ({filas.length} / {roles.length})
          </h3>

          <div className={styles.usersFilters}>
            <select
              value={filtroActivo}
              onChange={(e) =>
                setFiltroActivo(
                  e.target.value as "activos" | "inactivos" | "todos"
                )
              }
              className={styles.select}
              style={{ minWidth: 130, fontSize: 12, padding: "6px 8px" }}
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>

            <input
              placeholder="Buscar rol o descripción..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className={styles.searchInput}
            />

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={abrirCreacion}
            >
              + Nuevo rol
            </button>
          </div>
        </div>

        {cargando ? (
          <div style={{ color: "#374151", fontSize: 13 }}>Cargando...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Aprobador directo</th>
                  {/*<th>Cadena de aprobación</th>*/}
                  <th>Lidera</th>
                  <th>Autoaprob.</th>
                  <th>Usuarios</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody style={{ backgroundColor: "white" }}>
                {filas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: "#6b7280",
                      }}
                    >
                      No hay roles que coincidan.
                    </td>
                  </tr>
                ) : (
                  filas.map(({ rol, depth }) => {
                    const cadena = cadenaDe(rol, mapaRoles);
                    return (
                      <tr
                        key={rol.id}
                        style={{ opacity: rol.activo ? 1 : 0.55 }}
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
                              <span style={{ color: "#9ca3af" }}>↳</span>
                            )}
                            <div>
                              <div style={{ fontWeight: 700 }}>
                                {rol.nombre}
                              </div>
                              {rol.descripcion && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#6b7280",
                                  }}
                                >
                                  {rol.descripcion}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          {rol.superior != null
                            ? mapaRoles.get(rol.superior)?.nombre ?? "-"
                            : "— (raíz)"}
                        </td>

                        {/*<td>
                          <span className={styles.chain}>
                            {cadena
                              .map((r) => r.nombre)
                              .join(" → ")}
                          </span>
                        </td>*/}

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

                        <td>{contarUsuarios(rol.nombre)}</td>

                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => abrirEdicion(rol)}
                              className={styles.createToggleBtn}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminar(rol)}
                              className={styles.createToggleBtn}
                              style={{ color: "#b91c1c" }}
                              title="Solo se elimina si no está en uso"
                            >
                              Eliminar
                            </button>
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
        <RolModal
          key={rolEditando?.id ?? "nuevo"}
          rol={rolEditando}
          opcionesSuperior={opcionesSuperior}
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
