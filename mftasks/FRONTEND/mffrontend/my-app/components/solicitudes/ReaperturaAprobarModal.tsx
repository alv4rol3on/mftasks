"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { EquipoInfo, Task } from "@/lib/types";
import Modal from "@/components/ui/Modal";

export type AprobarReaperturaPayload = {
  plazo_dias: number;
  subtareas: { descripcion: string; asignado: number; peso: number }[];
  subtareas_reactivar: number[];
};

type Props = {
  tarea: Task;
  onClose: () => void;
  onSaved: (payload: AprobarReaperturaPayload) => Promise<void>;
};

type NuevaSubtarea = {
  key: string;
  descripcion: string;
  asignado: number | "";
  peso: number;
};

let contador = 1;

const nuevaFila = (): NuevaSubtarea => ({
  key: `r${contador++}`,
  descripcion: "",
  asignado: "",
  peso: 1,
});

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--color-background)",
  color: "var(--color-text)",
  fontFamily: "inherit",
};

const formatearFechaLocal = (fecha: Date): string => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const sumarDiasHabiles = (fecha: Date, dias: number): Date => {
  const resultado = new Date(fecha);
  let agregados = 0;

  while (agregados < dias) {
    resultado.setDate(resultado.getDate() + 1);

    const dia = resultado.getDay();

    if (dia !== 0 && dia !== 6) {
      agregados++;
    }
  }

  return resultado;
};

const contarDiasHabiles = (inicio: Date, fin: Date): number => {
  const actual = new Date(inicio);
  actual.setHours(0, 0, 0, 0);

  const limite = new Date(fin);
  limite.setHours(0, 0, 0, 0);

  let dias = 0;

  while (actual < limite) {
    actual.setDate(actual.getDate() + 1);

    if (actual.getDay() !== 0 && actual.getDay() !== 6) {
      dias++;
    }
  }

  return dias;
};

const formatearFechaHoraLocal = (fecha: Date): string => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  const hours = String(fecha.getHours()).padStart(2, "0");
  const minutes = String(fecha.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const obtenerFechaHoraMinima = () =>
  formatearFechaHoraLocal(sumarDiasHabiles(new Date(), 1));

const obtenerFechaHoraMaxima = () => {
  const fecha = sumarDiasHabiles(new Date(), 5);
  fecha.setHours(23, 59, 0, 0);

  return formatearFechaHoraLocal(fecha);
};

export default function ReaperturaAprobarModal({
  tarea,
  onClose,
  onSaved,
}: Props) {
  const [miembros, setMiembros] = useState<{ id: number; nombre: string }[]>([]);
  const [fechaLimite, setFechaLimite] = useState(() =>
    formatearFechaLocal(sumarDiasHabiles(new Date(), 3))
  );
  const [reactivar, setReactivar] = useState<number[]>([]);
  const [nuevas, setNuevas] = useState<NuevaSubtarea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiFetch<EquipoInfo>(`/api/usuarios/equipos/${tarea.equipo}/`)
      .then((equipo) => {
        const lista = (equipo.miembros ?? [])
          .filter((m) => !m.estado || m.estado === "ACTIVO")
          .map((m) => ({
            id: m.id_usuario ?? m.id_usuario ?? m.id,
            nombre: `${m.nombres} ${m.apellidos}`.trim(),
          }));
        if (equipo.lider && !lista.some((m) => m.id === equipo.lider!.id)) {
          lista.unshift({
            id: equipo.lider.id,
            nombre: `${equipo.lider.nombres} ${equipo.lider.apellidos}`.trim(),
          });
        }
        setMiembros(lista.filter((m) => m.id));
      })
      .catch(() => setMiembros([]));
  }, [tarea.equipo]);

  const anteriores = useMemo(
    () =>
      (tarea.subtareas ?? []).filter(
        (s) => s.estado === "SOLUCIONADO" || s.activo === false
      ),
    [tarea.subtareas]
  );

  const toggleReactivar = (id: number) => {
    setReactivar((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
    setError(null);
  };

  const actualizarNueva = (
    index: number,
    campo: keyof NuevaSubtarea,
    valor: string | number
  ) => {
    setNuevas((prev) =>
      prev.map((fila, i) => (i === index ? { ...fila, [campo]: valor } : fila))
    );
    setError(null);
  };

  const confirmar = async () => {
    const fechaSeleccionada = new Date(fechaLimite);

    const ahora = new Date();
    const fechaMaxima = sumarDiasHabiles(ahora, 5);
    fechaMaxima.setHours(23, 59, 59, 999);

    if (
      !fechaLimite ||
      Number.isNaN(fechaSeleccionada.getTime()) ||
      fechaSeleccionada <= ahora ||
      fechaSeleccionada > fechaMaxima ||
      fechaSeleccionada.getDay() === 0 ||
      fechaSeleccionada.getDay() === 6
    ) {
      setError("Selecciona una fecha y hora válida dentro de los próximos 5 días hábiles.");
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaDia = new Date(fechaSeleccionada);
    fechaDia.setHours(0, 0, 0, 0);

    const plazo = contarDiasHabiles(hoy, fechaDia);

    const validas = nuevas.filter(
      (fila) => fila.descripcion.trim() && fila.asignado !== ""
    );

    if (reactivar.length === 0 && validas.length === 0) {
      setError("Selecciona una subtarea anterior o agrega una nueva.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      await onSaved({
        plazo_dias: plazo,
        subtareas: validas.map((fila) => ({
          descripcion: fila.descripcion.trim(),
          asignado: Number(fila.asignado),
          peso: Math.max(1, Number(fila.peso) || 1),
        })),
        subtareas_reactivar: reactivar,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      title="Aprobar reapertura"
      onClose={enviando ? () => { } : onClose}
      maxWidth={680}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            style={{
              background: "var(--color-background)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={enviando}
            style={{
              background: "var(--color-brand)",
              color: "var(--color-on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {enviando ? "Aprobando…" : "Aprobar reapertura"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
          }}
        >
          <strong>Motivo del cliente:</strong>
          <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
            {tarea.motivo_reapertura || "Sin motivo registrado."}
          </p>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Fecha límite para solucionarlo *
          </span>

          <input
            type="datetime-local"
            value={fechaLimite}
            min={obtenerFechaHoraMinima()}
            max={obtenerFechaHoraMaxima()}
            onChange={(e) => {
              setFechaLimite(e.target.value);
              setError(null);
            }}
            disabled={enviando}
            style={{
              ...inputStyle,
              maxWidth: 260,
              colorScheme: "light dark",
            }}
          />

          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary)",
            }}
          >
            Puedes elegir una fecha dentro de los próximos 5 días hábiles.
          </span>
        </label>

        <section>
          <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>
            Reactivar subtareas anteriores
          </h4>
          {anteriores.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
              No hay subtareas anteriores disponibles para reactivar.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {anteriores.map((subtarea) => (
                <label
                  key={subtarea.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={reactivar.includes(subtarea.id)}
                    onChange={() => toggleReactivar(subtarea.id)}
                    disabled={enviando}
                  />
                  <span style={{ flex: 1 }}>
                    {subtarea.descripcion}
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {subtarea.asignado_nombre} · {subtarea.estado}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 13 }}>Agregar subtareas nuevas</h4>
            <button
              type="button"
              onClick={() => setNuevas((prev) => [...prev, nuevaFila()])}
              disabled={enviando}
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-text)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: enviando ? "not-allowed" : "pointer",
              }}
            >
              + Agregar subtarea
            </button>
          </div>

          {nuevas.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
              Puedes aprobar reactivando subtareas anteriores o creando nuevas.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {nuevas.map((fila, index) => (
                <div
                  key={fila.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 170px 80px 32px",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Descripción"
                    value={fila.descripcion}
                    onChange={(e) =>
                      actualizarNueva(index, "descripcion", e.target.value)
                    }
                    disabled={enviando}
                    style={inputStyle}
                  />
                  <select
                    value={fila.asignado}
                    onChange={(e) =>
                      actualizarNueva(
                        index,
                        "asignado",
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    disabled={enviando}
                    style={inputStyle}
                  >
                    <option value="">Asignar a…</option>
                    {miembros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={fila.peso}
                    onChange={(e) =>
                      actualizarNueva(index, "peso", Number(e.target.value))
                    }
                    disabled={enviando}
                    style={inputStyle}
                    aria-label="Peso"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNuevas((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={enviando}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--color-danger)",
                      cursor: enviando ? "not-allowed" : "pointer",
                      fontSize: 16,
                    }}
                    aria-label="Quitar subtarea"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && (
          <p role="alert" style={{ margin: 0, color: "var(--color-danger)", fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
