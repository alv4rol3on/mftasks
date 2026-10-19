import styles from "./Spinner.module.css";

type Props = {
  size?: number;
  className?: string;
};

export default function Spinner({ size = 20, className }: Props) {
  return (
    <span
      className={`${styles.spinner} ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg
        className={styles.icon}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      </svg>
    </span>
  );
}
