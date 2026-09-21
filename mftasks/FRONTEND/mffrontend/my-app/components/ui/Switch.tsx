"use client";

import styles from "./Switch.module.css";

type Props = {
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    loading?: boolean;
    title?: string;
    label?: string;
};

export default function Switch({
    checked,
    onChange,
    disabled = false,
    loading = false,
    title,
    label,
}: Props) {
    const bloqueado = disabled || loading;

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={title}
            disabled={bloqueado}
            onClick={(e) => {
                e.stopPropagation();
                if (bloqueado) return;
                onChange(!checked);
            }}
            className={`${styles.switch} ${checked ? styles.on : styles.off} ${
                bloqueado ? styles.disabled : ""
            }`}
        >
            <span className={styles.knob} />
        </button>
    );
}
