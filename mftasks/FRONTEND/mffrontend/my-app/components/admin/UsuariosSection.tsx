"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Pagination from "@/components/ui/Pagination";
import EditarUsuarioModal from "./EditarUsuarioModal";
import CrearUsuarioModal from "./CrearUsuarioModal";
import IconButton from "@/components/ui/IconButton";

import type { NivelInfo } from "@/lib/types";

import styles from "./AdminSections.module.css";

type TipoUsuario = "COLABORADOR" | "ADMINISTRADOR";

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
  nivel?: number | null;
  nivel_nombre?: string | null;
  puede_crear_solicitudes?: boolean;
  dni: string;
  bloqueo_estado_nivel?: string | null;
};

const PAGE_SIZE_USUARIOS = 10;

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "ADMINISTRADOR", label: "Administrador" },
];

type Props = {
  setMsg: (msg: string | null) => void;
};

export default function UsuariosSection({ setMsg }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [niveles, setNiveles] = useState<NivelInfo[]>([]);

  const [filtro, setFiltro] = useState("");
  const [filtroUsuarioTipo, setFiltroUsuarioTipo] = useState<string>("todos");
  const [filtroNivel, setFiltroNivel] = useState<string>("todos");

  const [pageUsuarios, setPageUsuarios] = useState(1);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [crearOpen, setCrearOpen] = useState(false);

  // Niveles asignables a colaboradores (activos y no de sistema).
  const nivelesJerarquicos = niveles
    .filter((n) => n.activo && !n.es_sistema)
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
      setMsg(`Error al cargar usuarios: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  };

  const cargarNiveles = async () => {
    try {
      const data = await apiFetch<NivelInfo[] | { results: NivelInfo[] }>(
        "/api/usuarios/niveles/"
      );
      setNiveles(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setNiveles([]);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    cargarNiveles();
  }, []);

  // --------------------------------------------------
  // ADMIN
  // --------------------------------------------------

  const esUsuarioAdmin = (u: Usuario) =>
    u.tipo_usuario === "ADMINISTRADOR";

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

    if (filtroNivel !== "todos") {
      if ((u.nivel_nombre ?? "").toLowerCase() !== filtroNivel.toLowerCase()) {
        return false;
      }
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
  }, [filtro, filtroUsuarioTipo, filtroNivel]);

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
              value={filtroNivel}
              onChange={e =>
                setFiltroNivel(e.target.value)
              }
              className={styles.select}
              style={{
                minWidth: 150,
                fontSize: 12,
                padding: "6px 8px",
              }}
            >
              <option value="todos">
                Todos los niveles
              </option>
              {nivelesJerarquicos.map((nivel) => (
                <option key={nivel.id} value={nivel.nombre}>
                  {nivel.nombre}
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
              color: "var(--color-text)",
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
                    <th>Nivel</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody
                  style={{
                    backgroundColor: "var(--color-background)",
                  }}
                >
                  {usuariosPaginados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          padding: 16,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        No hay usuarios que coincidan.
                      </td>
                    </tr>
                  ) : (
                    usuariosPaginados.map(u => {
                      const esAdmin = esUsuarioAdmin(u);

                      const badgeAdmin = {
                        background: "var(--color-badge)",
                        color: "var(--color-on-accent)",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 11,
                      } as const;

                      const badgeColab = {
                        background: "var(--color-badge)",
                        color: "var(--color-on-accent)",
                        padding: "2px 6px",
                        borderRadius: 999,
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
                              color: "var(--color-danger)",
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
                            {esAdmin ? (
                              <span style={badgeAdmin}>ADMINISTRADOR</span>
                            ) : (
                              <span style={badgeColab}>
                                {u.nivel_nombre || "-"}
                              </span>
                            )}
                          </td>

                          <td>
                            <IconButton
                              icon="settings"
                              variant="info"
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

      {editando && (
        <EditarUsuarioModal
          key={editando.id}
          usuario={editando}
          nivelesJerarquicos={nivelesJerarquicos}
          onClose={() => setEditando(null)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarUsuarios();
          }}
        />
      )}

      {crearOpen && (
        <CrearUsuarioModal
          nivelesJerarquicos={nivelesJerarquicos}
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
