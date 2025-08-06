"use client"

import type React from "react"
import { useState, useCallback, memo, useMemo, useEffect } from "react"
import { Copy, Check, BarChartIcon as ChartBar, ExternalLink, ImageIcon, Download, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import ReactMarkdown, { type Components } from "react-markdown"
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import javascript from "react-syntax-highlighter/dist/cjs/languages/prism/javascript"
import typescript from "react-syntax-highlighter/dist/cjs/languages/prism/typescript"
import python from "react-syntax-highlighter/dist/cjs/languages/prism/python"
import r from "react-syntax-highlighter/dist/cjs/languages/prism/r"
import sql from "react-syntax-highlighter/dist/cjs/languages/prism/sql"
import bash from "react-syntax-highlighter/dist/cjs/languages/prism/bash"
import powershell from "react-syntax-highlighter/dist/cjs/languages/prism/powershell"
import julia from "react-syntax-highlighter/dist/cjs/languages/prism/julia"
import scala from "react-syntax-highlighter/dist/cjs/languages/prism/scala"
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useTheme } from "@/context/ThemeContext"
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism"
import jsx from "react-syntax-highlighter/dist/cjs/languages/prism/jsx"
import tsx from "react-syntax-highlighter/dist/cjs/languages/prism/tsx"
import html from "react-syntax-highlighter/dist/cjs/languages/prism/markup"
import css from "react-syntax-highlighter/dist/cjs/languages/prism/css"
import json from "react-syntax-highlighter/dist/cjs/languages/prism/json"
import yaml from "react-syntax-highlighter/dist/cjs/languages/prism/yaml"
import markdown from "react-syntax-highlighter/dist/cjs/languages/prism/markdown"
import csharp from "react-syntax-highlighter/dist/cjs/languages/prism/csharp"
import cpp from "react-syntax-highlighter/dist/cjs/languages/prism/cpp"
import c from "react-syntax-highlighter/dist/cjs/languages/prism/c"
import ruby from "react-syntax-highlighter/dist/cjs/languages/prism/ruby"
import go from "react-syntax-highlighter/dist/cjs/languages/prism/go"
import rust from "react-syntax-highlighter/dist/cjs/languages/prism/rust"
import php from "react-syntax-highlighter/dist/cjs/languages/prism/php"
import java from "react-syntax-highlighter/dist/cjs/languages/prism/java"
import kotlin from "react-syntax-highlighter/dist/cjs/languages/prism/kotlin"
import dart from "react-syntax-highlighter/dist/cjs/languages/prism/dart"
import remarkGfm from "remark-gfm"
import { useS3Images } from "@/hooks/use-s3-images"

interface PredictionMetrics {
  accuracy?: number
  precision?: number
  recall?: number
}

interface CodeBlockProps {
  language: string
  value: string
  index: number
}

interface PredictionData {
  explicación?: string
  codigo?: string
  código_output?: string
}

interface Prediction {
  confidence: number
  data?: PredictionData
  visualization?: string
  metrics?: PredictionMetrics
}

interface PredictiveResponseProps {
  content: string
  timestamp?: string
  isStreaming?: boolean
  prediction?: Prediction
  project_id: string
  session_id: string
  isCollapsed?: boolean
  supabaseClient: SupabaseClient
  version_id: number
  onOpenCanvas?: () => void
  error?: boolean
  errorMessage?: string
  showReasoningButton?: boolean
  thinking?: string | boolean
  code?: string[]
}

// Registrar lenguajes
SyntaxHighlighter.registerLanguage("javascript", javascript)
SyntaxHighlighter.registerLanguage("typescript", typescript)
SyntaxHighlighter.registerLanguage("python", python)
SyntaxHighlighter.registerLanguage("r", r)
SyntaxHighlighter.registerLanguage("sql", sql)
SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("powershell", powershell)
SyntaxHighlighter.registerLanguage("julia", julia)
SyntaxHighlighter.registerLanguage("scala", scala)
SyntaxHighlighter.registerLanguage("jsx", jsx)
SyntaxHighlighter.registerLanguage("tsx", tsx)
SyntaxHighlighter.registerLanguage("html", html)
SyntaxHighlighter.registerLanguage("css", css)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("yaml", yaml)
SyntaxHighlighter.registerLanguage("yml", yaml)
SyntaxHighlighter.registerLanguage("md", markdown)
SyntaxHighlighter.registerLanguage("cs", csharp)
SyntaxHighlighter.registerLanguage("c++", cpp)
SyntaxHighlighter.registerLanguage("cpp", cpp)
SyntaxHighlighter.registerLanguage("c", c)
SyntaxHighlighter.registerLanguage("ruby", ruby)
SyntaxHighlighter.registerLanguage("go", go)
SyntaxHighlighter.registerLanguage("rust", rust)
SyntaxHighlighter.registerLanguage("php", php)
SyntaxHighlighter.registerLanguage("java", java)
SyntaxHighlighter.registerLanguage("kotlin", kotlin)
SyntaxHighlighter.registerLanguage("dart", dart)

const fetchThinkingContent = async (
  supabaseClient: SupabaseClient,
  sessionId: string,
  versionId: number,
): Promise<string | null> => {
  try {
    console.log("🔍 Buscando thinking content:", { sessionId, versionId })

    const { data, error } = await supabaseClient
      .from("hestia_agent_thinking")
      .select("output_think, created_at")
      .eq("session_id", sessionId)
      .eq("version_id", versionId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("❌ Error buscando thinking:", error)
      return null
    }

    if (!data || data.length === 0) {
      console.log("⚠️ No se encontró thinking content")
      return null
    }

    const thinkingRecord = data[0]

    if (!thinkingRecord?.output_think) {
      console.log("⚠️ Registro encontrado pero sin contenido de thinking")
      return null
    }

    console.log("✅ Thinking content encontrado:", {
      recordsFound: data.length,
      contentLength: thinkingRecord.output_think.length,
      preview: thinkingRecord.output_think.substring(0, 100) + "...",
    })

    return thinkingRecord.output_think
  } catch (error) {
    console.error("❌ Error en fetchThinkingContent:", error)
    return null
  }
}

const CodeBlock: React.FC<CodeBlockProps> = memo(({ language, value, index }) => {
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()

  const syntaxStyle = useMemo(() => {
    const baseStyle = theme === "dark" ? vscDarkPlus : oneLight
    return {
      ...baseStyle,
      'code[class*="language-"]': {
        ...baseStyle['code[class*="language-"]'],
        color: theme === "dark" ? baseStyle['code[class*="language-"]'].color : "hsl(220, 14%, 20%)",
        backgroundColor: "transparent",
      },
      'pre[class*="language-"]': {
        ...baseStyle['pre[class*="language-"]'],
        backgroundColor: "transparent",
      },
      ".token.keyword": {
        color: theme === "dark" ? baseStyle[".token.keyword"]?.color : "hsl(207, 82%, 40%)",
      },
      ".token.function": {
        color: theme === "dark" ? baseStyle[".token.function"]?.color : "hsl(5, 48%, 51%)",
      },
      ".token.string": {
        color: theme === "dark" ? baseStyle[".token.string"]?.color : "hsl(41, 99%, 30%)",
      },
      ".token.number": {
        color: theme === "dark" ? baseStyle[".token.number"]?.color : "hsl(5, 74%, 59%)",
      },
      ".token.comment": {
        color: theme === "dark" ? baseStyle[".token.comment"]?.color : "hsl(120, 30%, 40%)",
      },
    }
  }, [theme])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }

  return (
    <div className="relative my-4 rounded-lg overflow-hidden">
      <div
        className={`${theme} bg-[hsl(var(--card))] text-foreground text-sm px-3 sm:px-4 py-2 flex justify-between items-center`}
      >
        <span className="font-medium text-xs sm:text-sm">{language.toUpperCase()}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-[hsl(var(--accent))]"
          onClick={handleCopyCode}
        >
          {copied ? (
            <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language.toLowerCase()}
        style={syntaxStyle}
        showLineNumbers={true}
        customStyle={{
          margin: 0,
          backgroundColor: "transparent",
          borderRadius: 0,
          fontSize: "12px",
          padding: "0.75rem",
          lineHeight: "1.4",
          counterReset: "linenumber",
        }}
        lineNumberStyle={{
          minWidth: "1.5em",
          paddingRight: "0.5em",
          textAlign: "right",
          color: "hsl(220, 14%, 45%)",
          opacity: 0.5,
          fontSize: "11px",
        }}
        codeTagProps={{
          style: {
            backgroundColor: "transparent",
            lineHeight: "1.4",
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
})

CodeBlock.displayName = "CodeBlock"

const MarkdownLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const { href, children, className, ...rest } = props
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
       className={`text-blue-600 hover:text-blue-800 underline transition-colors break-all overflow-wrap-anywhere ${  
        className || ""  
      }`}  
    >
      {children}
    </a>
  )
}

export const PredictiveResponse = memo((props: PredictiveResponseProps) => {
  const [copied, setCopied] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [thinkingContent, setThinkingContent] = useState<string>("")
  const [isLoadingThinking, setIsLoadingThinking] = useState(false)
  const [thinkingError, setThinkingError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const {
    content,
    timestamp,
    supabaseClient,
    error,
    showReasoningButton,
    thinking,
    session_id,
    version_id,
    code,
    onOpenCanvas,
  } = props

  const { processedContent, isLoadingImages, hasS3Images } = useS3Images(content)

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const shouldShowThinkingButton = thinking === true || (typeof thinking === "string" && thinking.trim())

  const hasGeneratedCode = useMemo(() => {
    return code && Array.isArray(code) && code.length > 0
  }, [code])

  const handleCodeButtonClick = useCallback(() => {
    if (hasGeneratedCode && onOpenCanvas) {
      console.log("🎨 Abriendo código en canvas:", {
        session_id,
        version_id,
        codeUrls: code,
      })
      onOpenCanvas()
    }
  }, [hasGeneratedCode, onOpenCanvas, session_id, version_id, code])

  useEffect(() => {
    const loadThinkingContent = async () => {
      if (typeof thinking === "string" && thinking.trim()) {
        setThinkingContent(thinking)
        return
      }

      if (thinking === true) {
        setIsLoadingThinking(true)
        setThinkingError(null)

        const maxRetries = 3
        let attempt = 0

        const fetchWithRetry = async (): Promise<string | null> => {
          attempt++
          console.log(`🔄 Intento ${attempt}/${maxRetries} para cargar thinking`)

          try {
            const content = await fetchThinkingContent(supabaseClient, session_id, version_id)

            if (content) {
              console.log("✅ Thinking content cargado exitosamente")
              return content
            }

            if (attempt < maxRetries) {
              console.log(`⏳ Reintentando en ${attempt * 2}s...`)
              await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
              return fetchWithRetry()
            }

            return null
          } catch (error) {
            console.error(`❌ Error en intento ${attempt}:`, error)

            if (attempt < maxRetries) {
              console.log(`⏳ Reintentando en ${attempt * 2}s...`)
              await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
              return fetchWithRetry()
            }

            throw error
          }
        }

        try {
          const content = await fetchWithRetry()

          if (content) {
            setThinkingContent(content)
          } else {
            setThinkingError(
              "El contenido del razonamiento aún no está disponible. Intenta nuevamente en unos momentos.",
            )
          }
        } catch (error) {
          console.error("❌ Error final cargando thinking:", error)
          setThinkingError("Error al cargar el razonamiento. Verifica tu conexión e intenta nuevamente.")
        } finally {
          setIsLoadingThinking(false)
        }
      }
    }

    if (shouldShowThinkingButton) {
      loadThinkingContent()
    }
  }, [thinking, supabaseClient, session_id, version_id, shouldShowThinkingButton])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy message:", err)
    }
  }, [content])

  const handleRetryThinking = useCallback(async () => {
    if (thinking === true) {
      setIsLoadingThinking(true)
      setThinkingError(null)

      try {
        const content = await fetchThinkingContent(supabaseClient, session_id, version_id)
        if (content) {
          setThinkingContent(content)
        } else {
          setThinkingError("El contenido del razonamiento aún no está disponible.")
        }
      } catch (error) {
        console.error("Error reintentando thinking:", error)
        setThinkingError("Error al cargar el razonamiento.")
      } finally {
        setIsLoadingThinking(false)
      }
    }
  }, [thinking, supabaseClient, session_id, version_id])

  if (error) {
    return null
  }

  const components: Components = {
    code: ({ node, className, children, ...codeProps }) => {
      const match = /language-(\w+)/.exec(className || "")
      const lang = match ? match[1].toLowerCase() : ""

      const languageMap: { [key: string]: string } = {
        js: "javascript",
        ts: "typescript",
        py: "python",
        r: "r",
        sql: "sql",
        sh: "bash",
        ps: "powershell",
        jl: "julia",
        scala: "scala",
        jsx: "jsx",
        tsx: "tsx",
        typescriptreact: "tsx",
        javascriptreact: "jsx",
        html: "html",
        css: "css",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        md: "markdown",
        cs: "csharp",
        "c++": "cpp",
        cpp: "cpp",
        c: "c",
        rb: "ruby",
        go: "go",
        rs: "rust",
        php: "php",
        java: "java",
        kt: "kotlin",
        kotlin: "kotlin",
        dart: "dart",
      }

      const normalizedLang = languageMap[lang] || lang
      const isInline = !match
      const index = (node as any).position?.start.line || 0

      return isInline ? (
        <code className="px-1 py-0.5 bg-[hsl(var(--muted))] text-foreground rounded text-xs sm:text-sm" {...codeProps}>
          {children}
        </code>
      ) : (
        <CodeBlock language={normalizedLang} value={String(children).replace(/\n$/, "")} index={index} />
      )
    },
    img: ({ node, src, alt, ...imgProps }) => {
      if (!src) {
        return null
      }

      const handleDownloadImage = async (imageUrl: string, imageName: string) => {
        try {
          const response = await fetch(imageUrl)
          const blob = await response.blob()
          const objectUrl = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = objectUrl
          link.download = imageName || "imagen-generada.png"
          link.style.display = "none"
          document.body.appendChild(link)
          link.click()
          URL.revokeObjectURL(objectUrl)
          document.body.removeChild(link)
        } catch (error) {
          console.error("Error downloading image:", error)
          alert("No se pudo descargar la imagen. Intente abrir en nueva pestaña.")
        }
      }

      const handleOpenInNewTab = (imageUrl: string) => {
        window.open(imageUrl, "_blank")
      }

      const getImageName = (url: string, altText: string) => {
        try {
          const urlParts = url.split("/")
          const fileName = urlParts[urlParts.length - 1]
          if (fileName && fileName.includes(".")) {
            return fileName
          }
          return altText ? `${altText.replace(/[^a-zA-Z0-9]/g, "_")}.png` : "imagen-generada.png"
        } catch {
          return "imagen-generada.png"
        }
      }

      const imageName = getImageName(src as string, alt || "")

      return (
        <div className="relative group my-4 rounded-lg overflow-hidden bg-card/30 pl-2 sm:pl-5 max-w-[95%] sm:max-w-[70%] flex flex-col items-center justify-center">
          <img
            src={src || "/placeholder.svg"}
            alt={alt || "Imagen generada"}
            className="max-w-full h-auto object-contain bg-muted/20"
            style={{ maxHeight: isMobile ? "300px" : "450px" }}
            crossOrigin="anonymous"
            onError={(e) => {
              console.error("Error loading image:", src)
              e.currentTarget.style.display = "none"
            }}
            {...imgProps}
          />

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 sm:gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 sm:h-8 sm:w-8 p-0 bg-black/70 hover:bg-black/90 text-white border-none"
              onClick={() => handleDownloadImage(src as string, imageName)}
              title="Descargar imagen"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 sm:h-8 sm:w-8 p-0 bg-black/70 hover:bg-black/90 text-white border-none"
              onClick={() => handleOpenInNewTab(src as string)}
              title="Abrir en nueva pestaña"
            >
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          {alt && (
            <span>
              <p className="text-xs text-muted-foreground pl-2 sm:pl-3 italic">{alt}</p>
            </span>
          )}
        </div>
      )
    },
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table className="min-w-full border border-border my-4 text-xs sm:text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-background-100">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
    th: ({ children }) => (
      <th className="px-2 sm:px-4 py-2 text-left font-semibold bg-background border-gray-200 text-text text-xs sm:text-sm">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="px-2 sm:px-4 py-2 border border-gray-200 text-xs sm:text-sm">{children}</td>,
    h1: ({ node, ...headingProps }) => (
      <h1 className="text-xl sm:text-2xl font-bold mb-4 text-text" {...headingProps} />
    ),
    h2: ({ node, ...headingProps }) => <h2 className="text-lg sm:text-xl font-bold mb-3 text-text" {...headingProps} />,
    h3: ({ node, ...headingProps }) => (
      <h3 className="text-base sm:text-lg font-bold mb-2 text-text" {...headingProps} />
    ),
    p: ({ node, ...pProps }) => <span className="mb-4 text-sm sm:text-base" {...pProps} />,
    ul: ({ node, ...ulProps }) => <ul className="list-disc pl-4 sm:pl-6 mb-4" {...ulProps} />,
    ol: ({ node, ...olProps }) => <ol className="list-decimal pl-4 sm:pl-6 mb-4" {...olProps} />,
    li: ({ node, ...liProps }) => <li className="mb-1 text-sm sm:text-base" {...liProps} />,
    a: MarkdownLink,
  }

  return (
    <div className="relative group w-full pb-4">
      {shouldShowThinkingButton && (
        <div className="mt-4 mb-2">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showReasoning ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Razonamiento
            {isLoadingThinking && (
              <div className="ml-2 w-3 h-3 sm:w-4 sm:h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            )}
          </button>

          {showReasoning && (
            <div className="mt-2 p-2 sm:p-3 bg-card/50 text-text rounded-lg border-l-4 border-quaternary">
              {isLoadingThinking ? (
                <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  Cargando razonamiento...
                </div>
              ) : thinkingError ? (
                <div className="space-y-2">
                  <div className="text-amber-600 text-xs sm:text-sm">{thinkingError}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryThinking}
                    className="text-xs h-6 sm:h-7 px-2 bg-transparent"
                  >
                    Reintentar
                  </Button>
                </div>
              ) : thinkingContent ? (
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
                    {thinkingContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs sm:text-sm">
                    No se encontró contenido de razonamiento.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryThinking}
                    className="text-xs h-6 sm:h-7 px-2 bg-transparent"
                  >
                    Reintentar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`${isMobile ? "w-[98%]" : "w-full"}`}>
        {isLoadingImages && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            Cargando imágenes...
          </div>
        )}

        <div
          className={`
          w-full
          ${isMobile ? "bg-inherit px-1 pt-2" : "bg-background px-6"}
          rounded-lg shadow-sm
          ${props.isStreaming ? "typing-animation" : ""}
        `}
        >
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
              {processedContent}
            </ReactMarkdown>
          </div>

          {props.isStreaming && <span className="inline-block w-1 h-4 bg-primary animate-blink ml-1" />}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-2 sm:px-4 py-3 leading-relaxed">
          <div className="flex items-center gap-2 text-muted-foreground sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-card"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>

            {props.prediction?.visualization && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(props.prediction?.visualization, "_blank")}
              >
                <ChartBar className="h-4 w-4" />
              </Button>
            )}

            <span className={`${isMobile ? "text-sm py-1" : "text-xs"} text-muted-foreground`}>
              {timestamp && format(new Date(timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
            </span>
          </div>

          {/* Solo mostrar el botón del canvas en desktop (no móvil) */}
          {hasGeneratedCode && !isMobile && (
            <Button
              onClick={handleCodeButtonClick}
              variant="outline"
              style={{ borderColor: "hsl(227, 100%, 63%)" }}
              className="relative h-9 w-full sm:w-auto sm:h-8 px-4 overflow-hidden rounded-md hover:bg-background transition-colors bg-transparent"
            >
              <span className="relative text-sm font-medium flex items-center gap-2 text-foreground justify-center">
                <Code2 className="h-4 w-4" />
                Ver código en canvas
                {code && code.length > 1 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-quaternary text-background text-xs rounded-full">
                    {code.length}
                  </span>
                )}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})

PredictiveResponse.displayName = "PredictiveResponse"

export default PredictiveResponse
