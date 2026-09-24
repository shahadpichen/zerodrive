export type InterfaceStyle = "creator" | "modern";
export type ColorMode = "light" | "dark" | "system";
export const INTERFACE_STORAGE_KEY = "zerodrive-interface-style";
export const THEME_STORAGE_KEY = "vite-ui-theme";

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark" || value === "system";
}
export function readPreference(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function savePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Appearance still works for this session when persistence is unavailable.
  }
}
