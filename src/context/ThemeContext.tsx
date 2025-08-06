"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // Inicializar tema desde localStorage cuando el componente se monta
  useEffect(() => {
    // Verificar si hay un tema temporal de recarga
    const reloadTheme = localStorage.getItem(
      "hestia-current-theme"
    ) as Theme | null;

    if (reloadTheme) {
      setTheme(reloadTheme);
      localStorage.removeItem("hestia-current-theme");
    } else {
      // Si no hay tema de recarga, usar el tema guardado
      const savedTheme = localStorage.getItem("theme") as Theme | null;

      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        // Si no hay tema guardado, usar preferencia del sistema
        const systemPrefersDark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;

        setTheme(systemPrefersDark ? "dark" : "light");
      }
    }
  }, []);

  // Actualizar el DOM y localStorage cuando cambia el tema
  useEffect(() => {
    const root = document.documentElement;

    // Remover clases de tema anteriores
    root.classList.remove("dark", "light");
    // Añadir la clase del tema actual
    root.classList.add(theme);

    // Guardar en localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook personalizado para usar el tema
export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme debe ser usado dentro de un ThemeProvider");
  }

  return context;
}
