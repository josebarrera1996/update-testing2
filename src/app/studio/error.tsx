// app/predictive/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

export default function PredictiveError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const { theme } = useTheme();
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Algo salió mal!</h2>
        <Button
          onClick={() => reset()}
          variant="outline"
          className={`${
            theme == "dark" ? "bg-card" : "bg-black hover:bg-black/90"
          }`}
        >
          Intentar de nuevo
        </Button>
      </div>
    </div>
  );
}
