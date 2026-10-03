"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import SearchableSelect from "@/components/ui/SearchableSelect";
import Switch from "@/components/ui/Switch";

import type { RolInfo } from "@/lib/types";

import styles from "./AdminSections.module.css";

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

type FormRol = {
  nombre: string;
  descripcion: string;
  superior: string;
  puede_liderar: boolean;
  auto_aprobar: boolean;
  activo: boolean;
};

const FORM_VACIO: FormRol = {
  nombre: "",
  descripcion: "",
  superior: "",
  puede_liderar: false,
  auto_aprobar: false,
  activo: true,
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

  const [form, setForm] = useState<FormRol>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

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
  }, [roles, editandoId, mapaRoles]);

  // --------------------------------------------------
  // ACCIONES
  // --------------------------------------------------

  const iniciarCreacion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const iniciarEdicion = (rol: RolInfo) => {
    setEditandoId(rol.id);
    setForm({
      nombre: rol.nombre,
      descripcion: rol.descripcion ?? "",
      superior: rol.superior != null ? String(rol.superior) : "",
      puede_liderar: rol.puede_liderar,
      auto_aprobar: rol.auto_aprobar ?? false,
      activo: rol.activo,
    });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setMsg("El nombre del rol es obligatorio.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      superior: form.superior ? Number(form.superior) : null,
      puede_liderar: form.puede_liderar,
      auto_aprobar: form.auto_aprobar,
      activo: form.activo,
    };

    setGuardando(true);
    try {
      if (editandoId != null) {
        await apiFetch(`/api/usuarios/roles/${editandoId}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMsg(`Rol "${payload.nombre}" actualizado.`);
      } else {
        await apiFetch("/api/usuarios/roles/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMsg(`Rol "${payload.nombre}" creado.`);
      }
      iniciarCreacion();
      await cargarRoles();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (rol: RolInfo) => {
    try {
      await apiFetch(`/api/usuarios/roles/${rol.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !rol.activo }),
      });
      setMsg(`Rol "${rol.nombre}" ${rol.activo ? "desactivado" : "activado"}.`);
      await cargarRoles();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
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
      if (editandoId === rol.id) iniciarCreacion();
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
      {/* CREAR / EDITAR */}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          {editandoId != null
            ? `Editar rol: ${mapaRoles.get(editandoId)?.nombre ?? ""}`
            : "Crear nuevo rol"}
        </h3>

        <p className={styles.permisosDesc}>
          Un rol representa una posición. Su <strong>superior directo</strong>{" "}
          define quién aprueba sus solicitudes; la cadena completa
          (heredada) se calcula automáticamente y no se almacena.
        </p>

        <div className={styles.formGrid} style={{ marginTop: 12 }}>
          <input
            placeholder="Nombre del rol (p. ej. Coordinador)"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className={styles.input}
          />

          <input
            placeholder="Descripción (opcional)"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            className={styles.input}
          />

          <div className={styles.createField}>
            <span className={styles.createHint}>Superior directo (aprobador)</span>
            <SearchableSelect
              value={form.superior}
              onChange={(v) => setForm({ ...form, superior: v })}
              options={opcionesSuperior}
              placeholder="— Sin superior (raíz) —"
              emptyText="Sin roles disponibles"
            />
          </div>

          <div className={styles.createField}>
            <span className={styles.createHint}>
              Puede liderar equipos
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Switch
                checked={form.puede_liderar}
                onChange={(v) => setForm({ ...form, puede_liderar: v })}
                label="Puede liderar equipos"
                title="Permite asignar usuarios con este rol como líderes de equipo"
              />
              <span style={{ fontSize: 12, color: "#374151" }}>
                {form.puede_liderar ? "Sí" : "No"}
              </span>
            </div>
          </div>

          <div className={styles.createField}>
            <span className={styles.createHint}>
              Autoaprobación
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Switch
                checked={form.auto_aprobar}
                onChange={(v) => setForm({ ...form, auto_aprobar: v })}
                label="Autoaprobación"
                title="Las solicitudes de equipos de este rol saltan la fase de aprobadores y pasan directo a revisión del líder"
              />
              <span style={{ fontSize: 12, color: "#374151" }}>
                {form.auto_aprobar ? "Sí" : "No"}
              </span>
            </div>
          </div>

          <div className={styles.createField}>
            <span className={styles.createHint}>Estado</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Switch
                checked={form.activo}
                onChange={(v) => setForm({ ...form, activo: v })}
                label="Rol activo"
                title="Los roles inactivos no deberían asignarse a nuevos usuarios"
              />
              <span style={{ fontSize: 12, color: "#374151" }}>
                {form.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={guardar}
            className={styles.btnPrimary}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : editandoId != null
              ? "Guardar cambios"
              : "Crear rol"}
          </button>

          {editandoId != null && (
            <button
              type="button"
              onClick={iniciarCreacion}
              className={styles.createToggleBtn}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

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
                  <th>Cadena de aprobación</th>
                  <th>Lidera</th>
                  <th>Autoaprob.</th>
                  <th>Usuarios</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody style={{ backgroundColor: "white" }}>
                {filas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
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

                        <td>
                          <span className={styles.chain}>
                            {cadena
                              .map((r) => r.nombre)
                              .join(" → ")}
                          </span>
                        </td>

                        <td>
                          {rol.puede_liderar ? (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOn}`}
                            >
                              Sí
                            </span>
                          ) : (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOff}`}
                            >
                              No
                            </span>
                          )}
                        </td>

                        <td>
                          {rol.auto_aprobar ? (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOn}`}
                            >
                              Sí
                            </span>
                          ) : (
                            <span
                              className={`${styles.badgeActive} ${styles.badgeActiveOff}`}
                            >
                              No
                            </span>
                          )}
                        </td>

                        <td>{contarUsuarios(rol.nombre)}</td>

                        <td>
                          <Switch
                            checked={rol.activo}
                            onChange={() => toggleActivo(rol)}
                            label={rol.activo ? "Desactivar rol" : "Activar rol"}
                            title={rol.activo ? "Desactivar" : "Activar"}
                          />
                        </td>

                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => iniciarEdicion(rol)}
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
    </div>
  );
}
