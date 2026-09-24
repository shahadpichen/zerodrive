import { useTheme } from "../components/theme-provider";

export function Brand({ monochrome = false }: { monochrome?: boolean }) {
  const { interfaceStyle } = useTheme();
  return (
    <span className="inline-flex items-center gap-2">
      {interfaceStyle === "modern" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 40 40"
          className={`h-8 w-8 ${monochrome ? "text-foreground" : "modern-brand-mark"}`}
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M20 2C9 2 5 9 5 20s4 18 15 18 15-7 15-18S31 2 20 2Zm0 9a5 5 0 0 0-3 9v8h6v-8a5 5 0 0 0-3-9Z"
          />
        </svg>
      )}
      <span className="brand-wordmark text-lg font-semibold">
        Zero
        {interfaceStyle === "modern" ? (
          <span className={monochrome ? undefined : "modern-emphasis"}>
            Drive
          </span>
        ) : (
          "Drive"
        )}
      </span>
    </span>
  );
}
