"use client";

import { motion } from "framer-motion";

interface LoginButtonProps {
  signInWithGoogle: () => void;
}

export default function LoginButton({ signInWithGoogle }: LoginButtonProps) {
  return (
    <div className="w-full max-w-md mx-auto p-8">
      <motion.button
        onClick={signInWithGoogle}
        className="group relative w-full flex justify-center items-center py-3 px-6 border border-purple-500/30 text-sm font-medium rounded-lg text-white overflow-hidden bg-gradient-to-r from-purple-900/50 to-violet-900/50 backdrop-blur-sm"
        style={{
          background: `
            radial-gradient(circle at center, rgba(147, 51, 234, 0.4) 0%, rgba(88, 28, 135, 0.2) 50%, transparent 70%),
            linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(88, 28, 135, 0.1) 100%)
          `,
        }}
        whileHover={{
          scale: 1.0,
          boxShadow: "0 0 30px rgba(147, 51, 234, 0.3)",
        }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          ease: "easeOut",
        }}
      >
        {/* Efecto de brillo animado */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />

        {/* Gradiente radial animado en hover */}
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            background:
              "radial-gradient(circle at center, rgba(147, 51, 234, 0.6) 0%, transparent 70%)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 0.1, scale: 0.1 }}
          transition={{ duration: 0.1 }}
        />

        {/* Contenido del botón */}
        <span className="relative z-10 flex items-center gap-3">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Iniciar sesión con Google
        </span>

        {/* Borde brillante */}
        <div className="absolute inset-0 rounded-lg border border-purple-400/30 group-hover:border-purple-300/50 transition-colors duration-300" />
      </motion.button>
    </div>
  );
}
