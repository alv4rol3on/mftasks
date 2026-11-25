"use client";

import Modal from "@/components/ui/Modal";

import styles from "./AdminSections.module.css";

export type AccionCatalogo = {
  etiqueta: string;
  onClick: () => void | Promise<void>;
  tono?: "normal" | "danger" | "success" | "warning";
  disabled?: boolean;
  title?: string;
};

type Props = {
  titulo: string;
  subtitulo?: string;
  acciones: AccionCatalogo[];
  onClose: () => void;
  ocupado?: boolean;
};

export default function AccionesCatalogoModal({
  titulo,
  subtitulo,
  acciones,
  onClose,
  ocupado = false,
}: Props) {
  return (
    <Modal
      title={titulo}
      onClose={onClose}
      maxWidth={440}
      footer={
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onClose}
          disabled={ocupado}
        >
          Cerrar
        </button>
      }
    >
      <div className={styles.accionesModal}>
        {subtitulo && (
          <p className={styles.accionesSubtitulo}>{subtitulo}</p>
        )}

        <div className={styles.accionesLista}>
          {acciones.map((accion) => (
            <button
              key={accion.etiqueta}
              type="button"
              onClick={() => void accion.onClick()}
              disabled={ocupado || accion.disabled}
              title={accion.title}
              className={`${styles.accionBtn} ${
                accion.tono === "danger"
                  ? styles.accionBtnDanger
                  : accion.tono === "success"
                    ? styles.accionBtnSuccess
                    : accion.tono === "warning"
                      ? styles.accionBtnWarning
                      : ""
              }`}
            >
              {accion.etiqueta}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
