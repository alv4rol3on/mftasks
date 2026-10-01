"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Pagination from "@/components/ui/Pagination";
import Switch from "@/components/ui/Switch";

import styles from "./AdminSections.module.css";

type Usuario = {
  id: number;
  codigo?: string;
  email: string;
  nombres: string;
  apellidos: string;
  cargo?: string;
  is_active: boolean;
  roles?: string[];
};

const PAGE_SIZE_USUARIOS = 10;

type Props = {
  setMsg: (msg: string | null) => void;
};

export default function UsuariosSection({ setMsg }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);

  const [filtro, setFiltro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const [pageUsuarios, setPageUsuarios] = useState(1);

  const [nuevo, setNuevo] = useState({
    email: "",
    nombres: "",
    apellidos: "",
    cargo: "",
    password: "",
    rol: "miembro",
  });

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

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // --------------------------------------------------
  // CREAR USUARIO
  // --------------------------------------------------

  const crearUsuario = async () => {
    if (!nuevo.email || !nuevo.nombres || !nuevo.apellidos) {
      setMsg("Email, nombres y apellidos obligatorios");
      return;
    }

    try {
      await apiFetch("/api/usuarios/usuarios/", {
        method: "POST",
        body: JSON.stringify({
          email: nuevo.email,
          nombres: nuevo.nombres,
          apellidos: nuevo.apellidos,
          cargo: nuevo.cargo,
          password: nuevo.password || undefined,
          roles: [nuevo.rol],
        }),
      });

      setMsg(
        `Usuario ${nuevo.email} creado con rol ${nuevo.rol} y codigo auto-generado`
      );

      setNuevo({
        email: "",
        nombres: "",
        apellidos: "",
        cargo: "",
        password: "",
        rol: "miembro",
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
  // CAMBIAR ROL
  // --------------------------------------------------

  const cambiarRol = async (
    u: Usuario,
    nuevoRol: string
  ) => {
    const esAdmin = (u.roles ?? [])
      .map(r => r.toLowerCase())
      .includes("administrador");

    if (esAdmin) {
      setMsg(
        "Error: No se puede modificar rol de administradores"
      );
      return;
    }

    const rolesPermitidos = [
      "miembro",
      "gtr",
      "cliente",
      "gerente",
      "subgerente",
      "jefe",
      "asistente",
    ];

    if (!rolesPermitidos.includes(nuevoRol.toLowerCase())) {
      setMsg("Rol no permitido");
      return;
    }

    try {
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          roles: [nuevoRol],
        }),
      });

      setMsg(
        `Rol de ${u.email} cambiado a ${nuevoRol}`
      );

      await cargarUsuarios();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
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

    if (filtroTipo === "todos") return true;

    const rolesLow = (u.roles ?? [])
      .map(r => r.toLowerCase());

    return rolesLow.includes(
      filtroTipo.toLowerCase()
    );
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
  }, [filtro, filtroTipo]);

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
            value={nuevo.rol}
            onChange={e =>
              setNuevo({
                ...nuevo,
                rol: e.target.value,
              })
            }
            className={styles.select}
          >
            <option value="miembro">
              miembro
            </option>
            <option value="gtr">
              gtr
            </option>
            <option value="cliente">
              cliente
            </option>
            <option value="gerente">
              gerente
            </option>
            <option value="subgerente">
              subgerente
            </option>
            <option value="jefe">
              jefe
            </option>
            <option value="asistente">
              asistente
            </option>
            <option value="administrador">
              administrador
            </option>
          </select>
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
              value={filtroTipo}
              onChange={e =>
                setFiltroTipo(e.target.value)
              }
              className={styles.select}
              style={{
                minWidth: 140,
                fontSize: 12,
                padding: "6px 8px",
              }}
            >
              <option value="todos">
                Todos los roles
              </option>
              <option value="administrador">
                administrador
              </option>
              <option value="miembro">
                miembro
              </option>
              <option value="gtr">
                gtr
              </option>
              <option value="cliente">
                cliente
              </option>
              <option value="gerente">
                gerente
              </option>
              <option value="subgerente">
                subgerente
              </option>
              <option value="jefe">
                jefe
              </option>
              <option value="asistente">
                asistente
              </option>
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
                    <th>Email</th>
                    <th>Nombre</th>
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
                      const esAdmin =
                        (u.roles ?? [])
                          .map(r => r.toLowerCase())
                          .includes("administrador");

                      const rolActual =
                        (u.roles ?? [])[0] ??
                        "sin rol";

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
                            {u.email}
                          </td>

                          <td>
                            {u.nombres}{" "}
                            {u.apellidos}
                          </td>

                          <td>
                            {esAdmin ? (
                              <span
                                style={{
                                  background:
                                    "#fee2e2",
                                  color:
                                    "#991b1b",
                                  padding:
                                    "2px 6px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                }}
                              >
                                Administrador
                              </span>
                            ) : (
                              <select
                                value={rolActual.toLowerCase()}
                                onChange={e =>
                                  cambiarRol(
                                    u,
                                    e.target.value
                                  )
                                }
                                className={
                                  styles.select
                                }
                                style={{
                                  padding:
                                    "4px 6px",
                                  fontSize: 12,
                                }}
                              >
                                <option value="miembro">
                                  miembro
                                </option>
                                <option value="gtr">
                                  gtr
                                </option>
                                <option value="cliente">
                                  cliente
                                </option>
                                <option value="gerente">
                                  gerente
                                </option>
                                <option value="subgerente">
                                  subgerente
                                </option>
                                <option value="jefe">
                                  jefe
                                </option>
                                <option value="asistente">
                                  asistente
                                </option>
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