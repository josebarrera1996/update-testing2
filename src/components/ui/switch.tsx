"use client";

import { useTheme } from "@/context/ThemeContext";
import type React from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  id,
  className = "",
}) => {
  const { theme } = useTheme();

  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onCheckedChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2
        ${checked ? (theme === "dark" ? "bg-card" : "bg-primary") : "bg-input"}
        ${className}
      `}
    >
      <span
        className={`
          pointer-events-none block h-5 w-5 rounded-full
          shadow-lg ring-0 transition-transform
          ${checked ? "translate-x-6 bg-white" : "translate-x-1 bg-background"}
        `}
      />
    </button>
  );
};

export default Switch;
