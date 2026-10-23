"use client";

import styles from "@/components/cliente/SolicitudGenerada.module.css";

type Props = {
  title: string;
  ticket?: string | null;
  asunto?: string | null;
  buttonLabel?: string;
  onClose: () => void;
};

export default function SuccessModal({
  title,
  ticket,
  asunto,
  buttonLabel = "Aceptar",
  onClose,
}: Props) {
  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.circle}>
          <svg className={styles.check} viewBox="0 0 52 52" aria-hidden="true">
            <path d="M14 27 L23 36 L38 18" />
          </svg>
        </div>
        <h2 className={styles.title}>{title}</h2>
        {ticket && <p className={styles.ticket}>N.º {ticket}</p>}
        {asunto && <p className={styles.asunto}>{asunto}</p>}
        <button type="button" className={styles.button} onClick={onClose}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
