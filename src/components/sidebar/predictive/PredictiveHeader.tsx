// components/sidebar/predictive/PredictiveHeader.tsx
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface PredictiveHeaderProps {
  onToggleCollapse: () => void;
}

export function PredictiveHeader({ onToggleCollapse }: PredictiveHeaderProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`px-4 py-3 flex items-center justify-between ${
        theme === "dark" ? "bg-card/40 text-white" : "bg-card/40 text-black"
      }`}
    >
      <Link href="/studio">
        <div className="relative w-32 h-10">
          <Image
            src={
              theme === "dark" ? "/images/logo.png" : "/images/logo-light.png"
            }
            alt="Hestia Logo"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain transition-opacity duration-300"
            priority
          />
        </div>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className={`transition-colors ${
          theme == "dark" ? "hover:bg-card" : "hover-bg-muted"
        } `}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
    </div>
  );
}
