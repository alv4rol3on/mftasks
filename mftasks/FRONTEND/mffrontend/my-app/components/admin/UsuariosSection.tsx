"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Pagination from "@/components/ui/Pagination";
import Switch from "@/components/ui/Switch";

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
  is_active: boolean;
  tipo_usuario?: TipoUsuario;
  roles?: string[];
  dni: string
};

const PAGE_SIZE_USUARIOS = 10;

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "ADMINISTRADOR", label: "Administrador" },
];

const ROL_CLIENTE = "Cliente";
const ROL_ADMIN = "Administrador";

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

  const [nuevo, setNuevo] = useState<{
    email: string;
    nombres: string;
    apellidos: string;
    cargo: string;
    password: string;
    tipo_usuario: TipoUsuario;
    rol: string;
    dni: string
  }>({
    email: "",
    nombres: "",
    apellidos: "",
    cargo: "",
    password: "",
    tipo_usuario: "COLABORADOR",
    rol: "",
    dni: ""
  });

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
  // CREAR USUARIO
  // --------------------------------------------------

  const rolesParaTipo = (tipo: TipoUsuario, rol: string): string[] | null => {
    if (tipo === "CLIENTE") return [ROL_CLIENTE];
    if (tipo === "ADMINISTRADOR") return [ROL_ADMIN];
    if (!rol) return null;
    return [rol];
  };

  const handleDniChange = (value: string) => {
    const dni = value.replace(/\D/g, "").slice(0, 8);

    setNuevo({
      ...nuevo,
      dni,
    });
  };

  const crearUsuario = async () => {
    if (!nuevo.email || !nuevo.nombres || !nuevo.apellidos) {
      setMsg("Email, nombres y apellidos obligatorios");
      return;
    }

    if (!/^\d{8}$/.test(nuevo.dni)) {
      setMsg("El DNI debe contener exactamente 8 números.");
      return;
    }

    const rolesPayload = rolesParaTipo(nuevo.tipo_usuario, nuevo.rol);

    if (rolesPayload === null) {
      setMsg("Selecciona un rol para el colaborador.");
      return;
    }

    try {
      await apiFetch("/api/usuarios/usuarios/", {
        method: "POST",
        body: JSON.stringify({
          email: nuevo.email,
          nombres: nuevo.nombres,
          apellidos: nuevo.apellidos,
          dni: nuevo.dni,
          cargo: nuevo.cargo,
          password: nuevo.password || undefined,
          tipo_usuario: nuevo.tipo_usuario,
          roles: rolesPayload,
        }),
      });

      setMsg(
        `Usuario ${nuevo.email} creado (${nuevo.tipo_usuario.toLowerCase()})`
      );

      setNuevo({
        email: "",
        nombres: "",
        apellidos: "",
        cargo: "",
        password: "",
        tipo_usuario: "COLABORADOR",
        rol: "",
        dni: ""
      });

      await cargarUsuarios();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
  };

  // --------------------------------------------------
  // ACTIVAR / DESACTIVAR USUARIO
  // --------------------------------------------------

  const toggleActivo = async (u: Usuario) => {
    const esAdmin = (u.roles ?? [])
      .map(r => r.toLowerCase())
      .includes("administrador");

    if (esAdmin) {
      setMsg("Error: No se puede modificar usuarios administradores");
      return;
    }

    if (
      !confirm(
        `¿${u.is_active ? "Desactivar" : "Activar"} a ${u.nombres} ${u.apellidos} (${u.email})?`
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: !u.is_active,
        }),
      });

      setMsg(
        `${u.email} ${!u.is_active ? "activado" : "desactivado"}`
      );

      await cargarUsuarios();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  // --------------------------------------------------
  // CAMBIAR TIPO / ROL
  // --------------------------------------------------

  const esUsuarioAdmin = (u: Usuario) =>
    u.tipo_usuario === "ADMINISTRADOR" ||
    (u.roles ?? [])
      .map((r) => r.toLowerCase())
      .includes("administrador");

  const actualizarUsuario = async (
    u: Usuario,
    payload: Record<string, unknown>,
    etiqueta: string
  ) => {
    try {
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setMsg(`${u.email}: ${etiqueta}`);
      await cargarUsuarios();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
  };

  const cambiarTipo = async (
    u: Usuario,
    nuevoTipo: TipoUsuario
  ) => {
    if (esUsuarioAdmin(u)) {
      setMsg("Error: No se puede modificar usuarios administradores");
      return;
    }

    if (nuevoTipo === "CLIENTE") {
      await actualizarUsuario(
        u,
        { tipo_usuario: "CLIENTE", roles: [ROL_CLIENTE] },
        "tipo cambiado a Cliente"
      );
      return;
    }

    if (nuevoTipo === "ADMINISTRADOR") {
      await actualizarUsuario(
        u,
        { tipo_usuario: "ADMINISTRADOR", roles: [ROL_ADMIN] },
        "tipo cambiado a Administrador"
      );
      return;
    }

    // COLABORADOR: necesita un rol jerárquico. Conserva el actual si aplica;
    // si no, asigna el primero disponible.
    const actual = (u.roles ?? [])[0];
    const esJerarquico =
      actual != null &&
      rolesJerarquicos.some(
        (r) => r.nombre.toLowerCase() === actual.toLowerCase()
      );
    const rolAsignado = esJerarquico ? actual : rolesJerarquicos[0]?.nombre;

    if (!rolAsignado) {
      setMsg(
        "No hay roles jerárquicos disponibles. Cree uno en la pestaña Roles."
      );
      return;
    }

    await actualizarUsuario(
      u,
      { tipo_usuario: "COLABORADOR", roles: [rolAsignado] },
      `tipo cambiado a Colaborador (${rolAsignado})`
    );
  };

  const cambiarRol = async (u: Usuario, nuevoRol: string) => {
    if (esUsuarioAdmin(u)) {
      setMsg("Error: No se puede modificar el rol de administradores");
      return;
    }
    if (!nuevoRol) {
      setMsg("Selecciona un rol válido");
      return;
    }

    await actualizarUsuario(
      u,
      { tipo_usuario: "COLABORADOR", roles: [nuevoRol] },
      `rol cambiado a ${nuevoRol}`
    );
  };

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

      {/* CREAR USUARIO */}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          Crear nuevo usuario
        </h3>

        <input
          placeholder="Nombres"
          value={nuevo.nombres}
          onChange={e =>
            setNuevo({
              ...nuevo,
              nombres: e.target.value,
            })
          }
          className={styles.input}
        />

        <input
          placeholder="Apellidos"
          value={nuevo.apellidos}
          onChange={e =>
            setNuevo({
              ...nuevo,
              apellidos: e.target.value,
            })
          }
          className={styles.input}
        />

        <input
          placeholder="DNI"
          value={nuevo.dni}
          onChange={e => handleDniChange(e.target.value)}
          className={styles.input}
          inputMode="numeric"
          maxLength={8}
          pattern="\d{8}"
          required
        />

        <div className={styles.formGrid}>
          <input
            placeholder="Email"
            value={nuevo.email}
            onChange={e =>
              setNuevo({
                ...nuevo,
                email: e.target.value,
              })
            }
            className={styles.input}
          />

          <input
            placeholder="Cargo"
            value={nuevo.cargo}
            onChange={e =>
              setNuevo({
                ...nuevo,
                cargo: e.target.value,
              })
            }
            className={styles.input}
          />

          <input
            placeholder="Password"
            type="password"
            value={nuevo.password}
            onChange={e =>
              setNuevo({
                ...nuevo,
                password: e.target.value,
              })
            }
            className={styles.input}
          />

          <select
            value={nuevo.tipo_usuario}
            onChange={e =>
              setNuevo({
                ...nuevo,
                tipo_usuario: e.target.value as TipoUsuario,
              })
            }
            className={styles.select}
          >
            {TIPOS_USUARIO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {nuevo.tipo_usuario === "COLABORADOR" && (
            <select
              value={nuevo.rol}
              onChange={e =>
                setNuevo({
                  ...nuevo,
                  rol: e.target.value,
                })
              }
              className={styles.select}
            >
              <option value="">Selecciona un rol...</option>
              {rolesJerarquicos.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={crearUsuario}
          className={styles.btnPrimary}
          style={{ marginTop: 12 }}
        >
          Crear
        </button>
      </div>

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

          </div>
        </div>

        {cargando ? (
          <div
            style={{
              color: "white",
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
                    <th>Tipo</th>
                    <th>Rol</th>
                    <th>Activo</th>
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
                        colSpan={6}
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
                      const rolEnLista = rolesJerarquicos.some(
                        r =>
                          r.nombre.toLowerCase() ===
                          rolActual.toLowerCase()
                      );

                      const badgeAdmin = {
                        background: "#fee2e2",
                        color: "#991b1b",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 11,
                      } as const;

                      const badgeCliente = {
                        background: "#e0e7ff",
                        color: "#3730a3",
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

                          <td>
                            {esAdmin ? (
                              <span style={badgeAdmin}>
                                Administrador
                              </span>
                            ) : (
                              <select
                                value={tipo}
                                onChange={e =>
                                  cambiarTipo(
                                    u,
                                    e.target.value as TipoUsuario
                                  )
                                }
                                className={styles.select}
                                style={{
                                  padding: "4px 6px",
                                  fontSize: 12,
                                }}
                              >
                                {TIPOS_USUARIO.map(t => (
                                  <option
                                    key={t.value}
                                    value={t.value}
                                  >
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          <td>
                            {esAdmin || tipo === "ADMINISTRADOR" ? (
                              <span style={badgeAdmin}>
                                Administrador
                              </span>
                            ) : tipo === "CLIENTE" ? (
                              <span style={badgeCliente}>
                                Cliente
                              </span>
                            ) : (
                              <select
                                value={rolEnLista ? rolActual : ""}
                                onChange={e =>
                                  cambiarRol(u, e.target.value)
                                }
                                className={styles.select}
                                style={{
                                  padding: "4px 6px",
                                  fontSize: 12,
                                }}
                              >
                                <option value="">
                                  Selecciona un rol...
                                </option>
                                {rolesJerarquicos.map(r => (
                                  <option
                                    key={r.id}
                                    value={r.nombre}
                                  >
                                    {r.nombre}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          <td>
                            <Switch
                              checked={u.is_active}
                              disabled={esAdmin}
                              onChange={() =>
                                toggleActivo(u)
                              }
                              label={
                                u.is_active
                                  ? "Desactivar usuario"
                                  : "Activar usuario"
                              }
                              title={
                                esAdmin
                                  ? "No se puede modificar administradores"
                                  : u.is_active
                                    ? "Desactivar"
                                    : "Activar"
                              }
                            />
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
    </div>
  );
}