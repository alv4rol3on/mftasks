import Spinner from "./Spinner";
import styles from "./PageLoader.module.css";

type Props = {
  label?: string;
  variant?: "content" | "screen";
};

export default function PageLoader({
  label = "Cargando…",
  variant = "content",
}: Props) {
  return (
    <div
      className={`${styles.loader} ${styles[variant]}`}
      role="status"
      aria-live="polite"
    >
      <Spinner size={variant === "screen" ? 34 : 26} />
      <p className={styles.label}>{label}</p>
    </div>
  );
}
