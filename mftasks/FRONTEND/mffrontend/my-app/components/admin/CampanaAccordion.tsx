"use client";

import type { ReactNode } from "react";

import styles from "./AdminSections.module.css";

type Subcampana = {
  id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
  campana: number;
};

type Campana = {
  id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
  subcampanas: Subcampana[];
};

type Props = {
  campana: Campana;
  abierta: boolean;
  onToggle: () => void;
  children: ReactNode;

  // Elementos adicionales que cada sección
  // puede mostrar en la cabecera.
  headerRight?: ReactNode;
  campaignSwitch?: ReactNode;

  // Permite ocultar el contador "X sub"
  // cuando otra sección muestra su propio contador.
  showSubCount?: boolean;
};

export default function CampanaAccordion({
  campana,
  abierta,
  onToggle,
  children,
  headerRight,
  campaignSwitch,
  showSubCount = true,
}: Props) {
  return (
    <div className={styles.campanaCard}>
      <button
        type="button"
        className={styles.campanaHead}
        onClick={onToggle}
        aria-expanded={abierta}
        aria-controls={`campana-body-${campana.id}`}
      >
        <div>
          <span className={styles.campanaTitle}>
            {campana.nombre}
          </span>{" "}

          <span className={styles.campanaCode}>
            ({campana.codigo})
          </span>

          <span
            className={`${styles.badgeActive} ${
              campana.activo
                ? styles.badgeActiveOn
                : styles.badgeActiveOff
            }`}
          >
            {campana.activo
              ? "activa"
              : "inactiva"}
          </span>
        </div>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {campaignSwitch}

          {headerRight}

          {showSubCount && (
            <span
              className={styles.campanaCount}
            >
              {campana.subcampanas.length} sub
            </span>
          )}

          <span
            className={`${styles.chevron} ${
              abierta
                ? styles.chevronOpen
                : ""
            }`}
          >
            ▸
          </span>
        </span>
      </button>

      <div
        id={`campana-body-${campana.id}`}
        className={`${styles.campanaBody} ${
          abierta
            ? styles.campanaBodyOpen
            : ""
        }`}
      >
        <div
          className={
            styles.campanaBodyInner
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}