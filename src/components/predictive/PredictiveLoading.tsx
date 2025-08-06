"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/context/ThemeContext"

interface PredictiveLoadingProps {
  isLoading: boolean
  isThinking?: boolean
}

export function PredictiveLoading({ isLoading, isThinking = false }: PredictiveLoadingProps) {
  const [stage, setStage] = useState<number>(0)
  const { theme } = useTheme()
  const messages = isThinking ? ["HestIA está pensando"] : ["HestIA recibió tu consulta", "HestIA te está respondiendo"]

  useEffect(() => {
    if (!isLoading) {
      setStage(0)
      return
    }

    if (isThinking) {
      setStage(0)
      return
    }

    const timer = setTimeout(() => {
      setStage(1)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isLoading, isThinking])

  if (!isLoading) return null

  return (
    <div className="flex justify-start pl-0 border-border w-full mb-6 sm:mb-12">
      <div className="w-full sm:w-[70%]">
        <div className="flex items-start gap-2 sm:gap-3 group">
          <div className="flex-1 overflow-hidden">
            <div className="bg-background rounded-lg px-2 sm:px-4 pl-3 sm:pl-6 py-2 shadow-md">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <motion.img
                    src={theme === "light" ? "/images/loading-light.gif" : "/images/loading-dark.gif"}
                    alt="Logo animado de carga"
                    className="w-5 h-5 sm:w-7 sm:h-7"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.p
                    className="text-foreground font-medium text-sm sm:text-base"
                    animate={{
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  >
                    {messages[stage]}
                  </motion.p>

                  <motion.div
                    className={`flex gap-1 ${theme == "dark" ? "text-white" : "text-primary"}`}
                    animate={{
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className={`${theme == "dark" ? "text-white" : "text-primary"} font-bold`}
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                          duration: 0.8,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                          delay: i * 0.2,
                        }}
                      >
                        .
                      </motion.span>
                    ))}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
