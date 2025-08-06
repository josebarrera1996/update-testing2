"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"

interface ThinkingDisplayProps {
  content: string
  isVisible: boolean
}

export function ThinkingDisplay({ content, isVisible }: ThinkingDisplayProps) {
  const [displayedContent, setDisplayedContent] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isWriting, setIsWriting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Efecto para animación de escritura más suave
  useEffect(() => {
    if (!isVisible || !content) {
      setDisplayedContent("")
      setCurrentIndex(0)
      setIsWriting(false)
      return
    }

    setIsWriting(true)

    if (currentIndex < content.length) {
      const timer = setTimeout(
        () => {
          setDisplayedContent(content.slice(0, currentIndex + 1))
          setCurrentIndex(currentIndex + 1)
        },
        isMobile ? 12 : 8, // Velocidad ligeramente más lenta en móvil
      )

      return () => clearTimeout(timer)
    } else {
      // Cuando termina de escribir, mantener visible por al menos 5 segundos
      const finishTimer = setTimeout(() => {
        setIsWriting(false)
      }, 5000)

      return () => clearTimeout(finishTimer)
    }
  }, [content, currentIndex, isVisible, isMobile])

  // Resetear cuando cambia el contenido
  useEffect(() => {
    setCurrentIndex(0)
    setDisplayedContent("")
    setIsWriting(false)
  }, [content])

  if (!isVisible || !content) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full"
      >
        <div className="bg-background rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              className="w-2 h-2 bg-primary rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 0.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
            <span className="text-xs sm:text-sm text-muted-foreground font-medium">HestIA está razonando...</span>
          </div>

          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Títulos más pequeños y con color muted
                h1: ({ children }) => (
                  <h1 className="text-base sm:text-lg font-semibold mb-2 text-muted-foreground">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm sm:text-base font-semibold mb-2 text-muted-foreground">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xs sm:text-sm font-semibold mb-1 text-muted-foreground">{children}</h3>
                ),
                // Párrafos con color muted
                p: ({ children }) => (
                  <p className="mb-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{children}</p>
                ),
                // Listas con color muted
                ul: ({ children }) => <ul className="list-disc pl-3 sm:pl-4 mb-2 text-muted-foreground">{children}</ul>,
                ol: ({ children }) => (
                  <ol className="list-decimal pl-3 sm:pl-4 mb-2 text-muted-foreground">{children}</ol>
                ),
                li: ({ children }) => <li className="mb-1 text-xs sm:text-sm text-muted-foreground">{children}</li>,
                // Texto en negrita
                strong: ({ children }) => <strong className="font-semibold text-muted-foreground">{children}</strong>,
                // Texto en cursiva
                em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                // Código inline
                code: ({ children }) => (
                  <code className="px-1 py-0.5 bg-muted/50 text-muted-foreground rounded text-xs">{children}</code>
                ),
              }}
            >
              {displayedContent}
            </ReactMarkdown>
            {isWriting && currentIndex < content.length && (
              <motion.span
                className="inline-block w-1 h-3 sm:h-4 bg-muted-foreground ml-1"
                animate={{ opacity: [0, 1, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
