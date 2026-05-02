import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  danger: string;
};

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
};

const STORAGE_KEY = "orin_theme_mode";

const lightColors: ThemeColors = {
  background: "#F4F9F6",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E4E7EC",
  text: "#1E2B24",
  textMuted: "#667085",
  accent: "#1F7A4C",
  accentSoft: "#EAF6EF",
  accentText: "#FFFFFF",
  danger: "#B42318"
};

const darkColors: ThemeColors = {
  background: "#0F1720",
  surface: "#16212B",
  surfaceAlt: "#111A22",
  border: "#2D3A46",
  text: "#F3F7FB",
  textMuted: "#A6B0BB",
  accent: "#63D297",
  accentSoft: "#123323",
  accentText: "#08120D",
  danger: "#F97066"
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored === "dark" || stored === "light") {
          setModeState(stored);
        }
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextMode);
    } catch {}
  }, []);

  const toggleMode = useCallback(async () => {
    await setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      colors: mode === "dark" ? darkColors : lightColors,
      setMode,
      toggleMode
    }),
    [mode, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used inside ThemeProvider");
  }
  return context;
}
