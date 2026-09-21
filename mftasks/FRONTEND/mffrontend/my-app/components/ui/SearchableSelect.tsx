"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizarNombre } from "@/lib/similitud";
import styles from "./SearchableSelect.module.css";

export interface SearchableOption {
    value: string;
    label: string;
    sublabel?: string;
}

type Props = {
    value: string;
    onChange: (value: string, option?: SearchableOption) => void;
    options: SearchableOption[];
    placeholder?: string;
    disabled?: boolean;
    emptyText?: string;
    maxVisible?: number;
};

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = "Buscar...",
    disabled = false,
    emptyText = "Sin resultados",
    maxVisible = 8,
}: Props) {
    const [abierto, setAbierto] = useState(false);
    const [query, setQuery] = useState("");
    const [highlight, setHighlight] = useState(0);
    const contRef = useRef<HTMLDivElement>(null);

    const seleccionado = options.find((o) => o.value === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (contRef.current && !contRef.current.contains(e.target as Node)) {
                setAbierto(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtrados = useMemo(() => {
        const q = normalizarNombre(query);
        const base = !q
            ? options
            : options.filter(
                  (o) =>
                      normalizarNombre(o.label).includes(q) ||
                      normalizarNombre(o.sublabel ?? "").includes(q)
              );
        return base.slice(0, maxVisible);
    }, [query, options, maxVisible]);

    const abrir = () => {
        if (disabled) return;
        setAbierto(true);
        setQuery("");
        setHighlight(0);
    };

    const seleccionar = (o: SearchableOption) => {
        onChange(o.value, o);
        setAbierto(false);
        setQuery("");
    };

    const limpiar = () => {
        onChange("");
        setQuery("");
        setAbierto(false);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!abierto) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtrados.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const o = filtrados[highlight];
            if (o) seleccionar(o);
        } else if (e.key === "Escape") {
            setAbierto(false);
            setQuery("");
        }
    };

    return (
        <div className={styles.wrap} ref={contRef}>
            <input
                type="text"
                className={styles.input}
                disabled={disabled}
                placeholder={seleccionado ? seleccionado.label : placeholder}
                value={abierto ? query : seleccionado?.label ?? ""}
                onFocus={abrir}
                onChange={(e) => {
                    setAbierto(true);
                    setQuery(e.target.value);
                    setHighlight(0);
                }}
                onKeyDown={onKeyDown}
            />
            {value && !disabled && (
                <button
                    type="button"
                    className={styles.clear}
                    onClick={limpiar}
                    aria-label="Limpiar selección"
                >
                    ✕
                </button>
            )}
            {abierto && (
                <div className={styles.dropdown}>
                    {filtrados.length === 0 ? (
                        <div className={styles.empty}>{emptyText}</div>
                    ) : (
                        filtrados.map((o, i) => (
                            <div
                                key={o.value}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    seleccionar(o);
                                }}
                                onMouseEnter={() => setHighlight(i)}
                                className={`${styles.option} ${
                                    i === highlight ? styles.optionActive : ""
                                }`}
                            >
                                <span className={styles.optionLabel}>{o.label}</span>
                                {o.sublabel && (
                                    <span className={styles.optionSub}>{o.sublabel}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
