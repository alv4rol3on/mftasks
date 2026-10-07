"use client";

import styles from "./RefreshButton.module.css";

type Variant = "solid" | "outline" | "ghost";

type Props = {
  onClick: () => void;
  loading?: boolean;
  title?: string;
  variant?: Variant;
  size?: number;
  disabled?: boolean;
  className?: string;
};

export default function RefreshButton({
  onClick,
  loading = false,
  title = "Recargar",
  variant = "solid",
  size = 16,
  disabled = false,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={title}
      aria-busy={loading}
      className={`${styles.btn} ${styles[variant]} ${className ?? ""}`}
    >
      <svg
        className={loading ? styles.spin : undefined}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
