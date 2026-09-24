import { createContext, useContext, useEffect, useState } from "react";
import {
  ColorMode,
  InterfaceStyle,
  INTERFACE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isColorMode,
  readPreference,
  savePreference,
} from "../appearance/preferences";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ColorMode;
  storageKey?: string;
};
type ThemeProviderState = {
  theme: ColorMode;
  setTheme: (theme: ColorMode) => void;
  resolvedTheme: "light" | "dark";
  interfaceStyle: InterfaceStyle;
  setInterfaceStyle: (style: InterfaceStyle) => void;
};
const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "light",
  resolvedTheme: "light",
  interfaceStyle: "creator",
  setTheme: () => {},
  setInterfaceStyle: () => {},
});

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  // Match build-time HTML first; restore preferences after hydration.
  const [theme, updateTheme] = useState<ColorMode>(defaultTheme);
  const [interfaceStyle, updateInterface] = useState<InterfaceStyle>("creator");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = readPreference(storageKey);
    updateTheme(isColorMode(saved) ? saved : defaultTheme);
    updateInterface(
      readPreference(INTERFACE_STORAGE_KEY) === "modern" ? "modern" : "creator",
    );
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media?.matches ?? false);
    update();
    media?.addEventListener?.("change", update);
    setReady(true);
    return () => media?.removeEventListener?.("change", update);
  }, [storageKey, defaultTheme]);
  const resolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.dataset.interface = interfaceStyle;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, interfaceStyle, ready]);
  return (
    <ThemeProviderContext.Provider
      value={{
        theme,
        resolvedTheme,
        interfaceStyle,
        setTheme: (next) => {
          savePreference(storageKey, next);
          updateTheme(next);
        },
        setInterfaceStyle: (next) => {
          savePreference(INTERFACE_STORAGE_KEY, next);
          updateInterface(next);
        },
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeProviderContext);
