"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import styles from "./MultiSelectCheckbox.module.css";

export interface MultiSelectOption {
  value: string;
  label: string;
}

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  textPrefix?: string;
  emptyLabel?: string;
  className?: string;
  buttonStyle?: CSSProperties;
};

function resumenSeleccion(
  value: string[],
  options: MultiSelectOption[],
  emptyLabel: string
): string {
  if (value.length === 0) return emptyLabel;
  if (options.length > 0 && value.length === options.length) {
    return "Todos los estados";
  }
  if (value.length === 1) {
    return options.find((option) => option.value === value[0])?.label ?? value[0];
  }
  return `${value.length} estados`;
}

export default function MultiSelectCheckbox({
  options,
  value,
  onChange,
  textPrefix = "",
  emptyLabel = "Selecciona estados",
  className,
  buttonStyle,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<CSSProperties>({});

  const contRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const objetivo = event.target as Node;
      if (
        contRef.current?.contains(objetivo) ||
        dropdownRef.current?.contains(objetivo)
      ) {
        return;
      }
      setAbierto(false);
    };

    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierto(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    const actualizarPosicion = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const mostrarAbajo =
        espacioAbajo >= 220 || espacioAbajo >= espacioArriba;
      const disponible = mostrarAbajo
        ? espacioAbajo - 8
        : espacioArriba - 8;

      setPosicion({
        position: "fixed",
        left: rect.left,
        width: Math.max(rect.width, 220),
        maxHeight: Math.max(120, Math.min(320, disponible)),
        ...(mostrarAbajo
          ? { top: rect.bottom + 4 }
          : { bottom: window.innerHeight - rect.top + 4 }),
      });
    };

    actualizarPosicion();
    window.addEventListener("resize", actualizarPosicion);
    window.addEventListener("scroll", actualizarPosicion, true);
    return () => {
      window.removeEventListener("resize", actualizarPosicion);
      window.removeEventListener("scroll", actualizarPosicion, true);
    };
  }, [abierto]);

  const alternar = (opcion: string) => {
    if (value.includes(opcion)) {
      onChange(value.filter((valor) => valor !== opcion));
    } else {
      onChange([...value, opcion]);
    }
  };

  const resumen = resumenSeleccion(value, options, emptyLabel);
  const texto = textPrefix ? `${textPrefix}: ${resumen}` : resumen;

  return (
    <div className={styles.wrap} ref={contRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.trigger} ${className ?? ""}`}
        style={buttonStyle}
        onClick={() => setAbierto((actual) => !actual)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={textPrefix ? `${textPrefix}: ${resumen}` : resumen}
        title={texto}
      >
        <span className={styles.summary}>{texto}</span>
        <span className={styles.chevron} aria-hidden="true">▾</span>
      </button>

      {abierto &&
        createPortal(
          <div
            ref={dropdownRef}
            className={styles.dropdown}
            style={posicion}
            role="group"
            aria-label={textPrefix || "Estados"}
          >
            {options.map((option) => (
              <label key={option.value} className={styles.option}>
                <input
                  type="checkbox"
                  checked={value.includes(option.value)}
                  onChange={() => alternar(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
