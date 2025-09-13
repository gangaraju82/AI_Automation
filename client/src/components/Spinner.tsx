// Extend props
interface LoaderProps {
  size?: "sm" | "md" | "lg" | number;
  label?: string;
  show?: boolean;
  overlay?: boolean;
}

// Example Spinner updated
export const Spinner: React.FC<LoaderProps> = ({
  size = "md",
  label = "Loading...",
  show = true,
  overlay = false,
}) => {
  if (!show) return null;

  const { sz, num } =
    typeof size === "number"
      ? { sz: "", num: size }
      : size === "sm"
      ? { sz: "h-4 w-4", num: 16 }
      : size === "lg"
      ? { sz: "h-6 w-6", num: 24 }
      : { sz: "h-5 w-5", num: 20 };

  const spinner = (
    <svg
      role="status"
      aria-label={label}
      className={`${typeof size === "number" ? "" : sz} animate-spin text-white dark:text-white fill-transparent`.replace(
        /\s+/g,
        " "
      )}
      style={typeof size === "number" ? { width: num, height: num } : {}}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      {/* Background circle */}
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      {/* Spinning arc */}
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
      <span className="sr-only">{label}</span>
    </svg>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-white dark:text-white">
        <div className="text-center">
          {spinner}
          <p className="mt-3 text-sm text-white dark:text-white">{label}</p>
        </div>
      </div>
    );
  }

  return spinner;
};
