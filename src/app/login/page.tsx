// src/app/login/page.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import LoginButton from "@/components/ui/login-button";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const { user, isLoading } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/studio");
    }
  }, [user, isLoading, router]);

  // Title animation variants
  const titleVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
      },
    },
  };

  return (
    <div
      className={`min-h-screen flex-col flex items-center justify-center bg-background`}
    >
      <div className="text-center">
        {/* Title with animation and glow effect */}
        <motion.h1
          className="text-6xl font-bold mb-8 text-center"
          variants={titleVariants}
          initial="hidden"
          animate="visible"
          style={{
            background: "linear-gradient(to right, #8a2be2, #954ce9, #a370f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 8px rgba(149, 76, 233, 0.3)",
          }}
          whileInView={{
            textShadow: [
              "0 0 8px rgba(149, 76, 233, 0.3)",
              "0 0 15px rgba(149, 76, 233, 0.7)",
              "0 0 8px rgba(149, 76, 233, 0.3)",
            ],
            transition: {
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "reverse",
            },
          }}
        >
          Bienvenido a HestIA 3.0
        </motion.h1>
      </div>
      <div className="mt-4 space-y-6">
        <LoginButton signInWithGoogle={signInWithGoogle} />
      </div>
    </div>
  );
}
