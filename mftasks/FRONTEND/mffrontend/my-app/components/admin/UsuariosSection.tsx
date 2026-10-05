"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Pagination from "@/components/ui/Pagination";
import EditarUsuarioModal from "./EditarUsuarioModal";
import CrearUsuarioModal from "./CrearUsuarioModal";

import type { RolInfo } from "@/lib/types";

import styles from "./AdminSections.module.css";

type TipoUsuario = "COLABORADOR" | "CLIENTE" | "ADMINISTRADOR";

type Usuario = {
  id: number;
  codigo?: string;
  email: string;
  nombres: string;
  apellidos: string;
  cargo?: string;
  descripcion_cargo?: string;
  telefono?: string;
  is_active: boolean;
  tipo_usuario?: TipoUsuario;
  roles?: string[];
  dni: string;
  bloqueo_estado_rol?: string | null;
};

const PAGE_SIZE_USUARIOS = 10;

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "ADMINISTRADOR", label: "Administrador" },
];

type Props = {
  setMsg: (msg: string | null) => void;
};

export default function UsuariosSection({ setMsg }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [roles, setRoles] = useState<RolInfo[]>([]);

  const [filtro, setFiltro] = useState("");
  const [filtroUsuarioTipo, setFiltroUsuarioTipo] = useState<string>("todos");
  const [filtroRol, setFiltroRol] = useState<string>("todos");

  const [pageUsuarios, setPageUsuarios] = useState(1);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [crearOpen, setCrearOpen] = useState(false);

  // Roles jerárquicos asignables a colaboradores (activos, sin los de sistema).
  const rolesJerarquicos = roles
    .filter(
      (r) =>
        r.activo &&
        !["cliente", "administrador"].includes(r.nombre.toLowerCase())
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // --------------------------------------------------
  // CARGAR USUARIOS
  // --------------------------------------------------

  const cargarUsuarios = async () => {
    setCargando(true);

    try {
      const data = await apiFetch<
        Usuario[] | { results: Usuario[] }
      >("/api/usuarios/usuarios/");

      const arr = Array.isArray(data)
        ? data
        : data.results ?? [];

      setUsuarios(arr);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const cargarRoles = async () => {
    try {
      const data = await apiFetch<RolInfo[] | { results: RolInfo[] }>(
        "/api/usuarios/roles/"
      );
      setRoles(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setRoles([]);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, []);

  // --------------------------------------------------
  // ADMIN
  // --------------------------------------------------

  const esUsuarioAdmin = (u: Usuario) =>
    u.tipo_usuario === "ADMINISTRADOR" ||
    (u.roles ?? [])
      .map((r) => r.toLowerCase())
      .includes("administrador");

  // --------------------------------------------------
  // FILTROS
  // --------------------------------------------------

  const usuariosFiltrados = usuarios.filter(u => {
    const q = filtro.toLowerCase().trim();

    const matchTexto =
      !q ||
      u.email.toLowerCase().includes(q) ||
      `${u.nombres} ${u.apellidos}`
        .toLowerCase()
        .includes(q) ||
      (u.codigo ?? "")
        .toLowerCase()
        .includes(q);

    if (!matchTexto) return false;

    if (
      filtroUsuarioTipo !== "todos" &&
      (u.tipo_usuario ?? "COLABORADOR") !== filtroUsuarioTipo
    ) {
      return false;
    }

    if (filtroRol !== "todos") {
      const rolesLow = (u.roles ?? []).map(r => r.toLowerCase());
      if (!rolesLow.includes(filtroRol.toLowerCase())) return false;
    }

    return true;
  });

  // --------------------------------------------------
  // PAGINACIÓN
  // --------------------------------------------------

  const totalPagesUsuarios = Math.max(
    1,
    Math.ceil(
      usuariosFiltrados.length /
      PAGE_SIZE_USUARIOS
    )
  );

  const usuariosPaginados =
    usuariosFiltrados.slice(
      (pageUsuarios - 1) *
      PAGE_SIZE_USUARIOS,
      pageUsuarios *
      PAGE_SIZE_USUARIOS
    );

  useEffect(() => {
    setPageUsuarios(1);
  }, [filtro, filtroUsuarioTipo, filtroRol]);

  useEffect(() => {
    if (pageUsuarios > totalPagesUsuarios) {
      setPageUsuarios(1);
    }
  }, [
    totalPagesUsuarios,
    pageUsuarios,
  ]);

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.container}>
      {/* LISTA DE USUARIOS */}

      <div className={styles.card}>
        <div className={styles.usersHeader}>

          <h3
            className={styles.cardTitle}
            style={{ margin: 0 }}
          >
            Usuarios ({usuariosFiltrados.length} /{" "}
            {usuarios.length})
          </h3>

          <div className={styles.usersFilters}>

            <select
              value={filtroUsuarioTipo}
              onChange={e =>
                setFiltroUsuarioTipo(e.target.value)
              }
              className={styles.select}
              style={{
                minWidth: 150,
                fontSize: 12,
                padding: "6px 8px",
              }}
            >
              <option value="todos">
                Todos los tipos
              </option>
              {TIPOS_USUARIO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={filtroRol}
              onChange={e =>
                setFiltroRol(e.target.value)
              }
              className={styles.select}
              style={{
                minWidth: 150,
                fontSize: 12,
                padding: "6px 8px",
              }}
            >
              <option value="todos">
                Todos los roles
              </option>
              {rolesJerarquicos.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>

            <input
              placeholder="Buscar por email, nombre o codigo MFS-"
              value={filtro}
              onChange={e =>
                setFiltro(e.target.value)
              }
              className={styles.searchInput}
            />

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setCrearOpen(true)}
            >
              + Crear usuario
            </button>

          </div>
        </div>

        {cargando ? (
          <div
            style={{
              color: "#374151",
              fontSize: 13,
            }}
          >
            Cargando...
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>

                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody
                  style={{
                    backgroundColor: "white",
                  }}
                >
                  {usuariosPaginados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          padding: 16,
                          color: "#6b7280",
                        }}
                      >
                        No hay usuarios que coincidan.
                      </td>
                    </tr>
                  ) : (
                    usuariosPaginados.map(u => {
                      const esAdmin = esUsuarioAdmin(u);

                      const tipo: TipoUsuario =
                        u.tipo_usuario ??
                        (esAdmin ? "ADMINISTRADOR" : "COLABORADOR");

                      const rolActual = (u.roles ?? [])[0] ?? "";

                      const badgeAdmin = {
                        background: "#3a6aed",
                        color: "#fafafa",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 11,
                      } as const;

                      const badgeCliente = {
                        background: "#00ca1b",
                        color: "#fafafa",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 11,
                      } as const;

                      const badgeColab = {
                        background: "#d10000",
                        color: "#fafafa",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 11,
                      } as const;

                      return (
                        <tr
                          key={u.id}
                          style={{
                            opacity: esAdmin
                              ? 0.6
                              : 1,
                          }}
                        >
                          <td
                            style={{
                              fontFamily:
                                "monospace",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#991b1b",
                            }}
                          >
                            {u.codigo ?? "-"}
                          </td>

                          <td>
                            {u.nombres}{" "}
                            {u.apellidos}
                          </td>

                          <td style={{ fontSize: 12 }}>
                            {u.email}
                          </td>

                          <td>
                            {esAdmin || tipo === "ADMINISTRADOR" ? (
                              <span style={badgeAdmin}>
                                ADMINISTRADOR
                              </span>
                            ) : tipo === "CLIENTE" ? (
                              <span style={badgeCliente}>
                                CLIENTE
                              </span>
                            ) : (
                              <span style={badgeColab}>{rolActual || "-"}</span>
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className={styles.btnEdit}
                              disabled={esAdmin}
                              title={
                                esAdmin
                                  ? "No se puede modificar administradores"
                                  : "Editar información del usuario"
                              }
                              onClick={() => {
                                if (esAdmin) return;
                                setEditando(u);
                              }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

              </table>
            </div>

            <Pagination
              page={pageUsuarios}
              totalPages={totalPagesUsuarios}
              totalItems={
                usuariosFiltrados.length
              }
              pageSize={PAGE_SIZE_USUARIOS}
              onPageChange={setPageUsuarios}
            />
          </>
        )}
      </div>

      {editando && (
        <EditarUsuarioModal
          key={editando.id}
          usuario={editando}
          rolesJerarquicos={rolesJerarquicos}
          onClose={() => setEditando(null)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarUsuarios();
          }}
        />
      )}

      {crearOpen && (
        <CrearUsuarioModal
          rolesJerarquicos={rolesJerarquicos}
          onClose={() => setCrearOpen(false)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarUsuarios();
          }}
        />
      )}
    </div>
  );
}
