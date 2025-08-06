"use client"

import { useState, useEffect, useCallback } from "react"
import { Editor } from "@monaco-editor/react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Check,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  X,
  FileCode,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useTheme } from "@/context/ThemeContext"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface GitHubFile {
  url: string
  fileName: string
  filePath: string
  content: string | null
  language: string
  loading: boolean
  error: string | null
}

interface CodeCanvasProps {
  codeUrls: string[]
  sessionId: string
  versionId: number
  onClose: () => void
  isExpanded?: boolean
  onToggleExpand: () => void
}

// Función para detectar el lenguaje basado en la extensión del archivo
const getLanguageFromFileName = (fileName: string): string => {
  const extension = fileName.split(".").pop()?.toLowerCase()

  const languageMap: { [key: string]: string } = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    kt: "kotlin",
    swift: "swift",
    scala: "scala",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    dockerfile: "dockerfile",
    r: "r",
    matlab: "matlab",
    vue: "vue",
    svelte: "svelte",
  }

  return languageMap[extension || ""] || "plaintext"
}

// Función para extraer información del archivo desde la URL de GitHub
const parseGitHubUrl = (url: string): { fileName: string; filePath: string } => {
  try {
    const urlParts = url.split("/")
    const fileName = urlParts[urlParts.length - 1]

    const blobIndex = urlParts.findIndex((part) => part === "blob")
    if (blobIndex !== -1 && blobIndex + 2 < urlParts.length) {
      const filePath = urlParts.slice(blobIndex + 2).join("/")
      return { fileName, filePath }
    }

    return { fileName, filePath: fileName }
  } catch (error) {
    console.error("Error parsing GitHub URL:", error)
    return { fileName: "unknown", filePath: "unknown" }
  }
}

// Función para obtener contenido usando la API route del servidor
const fetchGitHubContent = async (url: string): Promise<string> => {
  try {
    console.log("🔍 Fetching content via API route for:", url)

    const response = await fetch("/api/github/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success || !data.content) {
      throw new Error("No content received from API")
    }

    console.log("✅ Content fetched successfully, length:", data.content.length)
    return data.content
  } catch (error) {
    console.error("❌ Error fetching GitHub content:", error)
    throw error
  }
}

export function CodeCanvas({
  codeUrls,
  sessionId,
  versionId,
  onClose,
  isExpanded = false,
  onToggleExpand,
}: CodeCanvasProps) {
  const { theme } = useTheme()
  const [files, setFiles] = useState<GitHubFile[]>([])
  const [activeTab, setActiveTab] = useState<string>("")
  const [copied, setCopied] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Inicializar archivos desde las URLs
  useEffect(() => {
    const initializeFiles = () => {
      console.log("🚀 Initializing files with URLs:", codeUrls)

      const initialFiles: GitHubFile[] = codeUrls.map((url, index) => {
        const { fileName, filePath } = parseGitHubUrl(url)
        const language = getLanguageFromFileName(fileName)

        console.log(`📁 File ${index}:`, { url, fileName, filePath, language })

        return {
          url,
          fileName,
          filePath,
          content: null,
          language,
          loading: true,
          error: null,
        }
      })

      setFiles(initialFiles)

      // Establecer la primera pestaña como activa
      if (initialFiles.length > 0) {
        setActiveTab(initialFiles[0].url)
        setCurrentFileIndex(0)
      }
    }

    if (codeUrls.length > 0) {
      initializeFiles()
    }
  }, [codeUrls])

  // Cargar contenido de los archivos
  useEffect(() => {
    const loadFileContent = async (file: GitHubFile, index: number) => {
      try {
        console.log(`📁 Loading content for: ${file.fileName} from ${file.url}`)

        const content = await fetchGitHubContent(file.url)

        setFiles((prevFiles) =>
          prevFiles.map((f, i) => (i === index ? { ...f, content, loading: false, error: null } : f)),
        )

        console.log(`✅ Successfully loaded ${file.fileName}`)
      } catch (error) {
        console.error(`❌ Error loading ${file.fileName}:`, error)

        const errorMessage = error instanceof Error ? error.message : "Error desconocido"

        setFiles((prevFiles) =>
          prevFiles.map((f, i) =>
            i === index
              ? {
                  ...f,
                  loading: false,
                  error: errorMessage,
                }
              : f,
          ),
        )
      }
    }

    // Cargar contenido de todos los archivos
    files.forEach((file, index) => {
      if (file.loading && !file.content && !file.error) {
        loadFileContent(file, index)
      }
    })
  }, [files])

  // Función para copiar código
  const handleCopyCode = useCallback(async (content: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(fileName)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error("Error copying code:", error)
    }
  }, [])

  // Función para descargar archivo
  const handleDownloadFile = useCallback((content: string, fileName: string) => {
    try {
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading file:", error)
    }
  }, [])

  // Función para reintentar carga de archivo
  const handleRetryLoad = useCallback((index: number) => {
    setFiles((prevFiles) => prevFiles.map((f, i) => (i === index ? { ...f, loading: true, error: null } : f)))
  }, [])

  // Navegación entre archivos en móvil
  const handlePreviousFile = useCallback(() => {
    if (files.length > 0) {
      const newIndex = currentFileIndex > 0 ? currentFileIndex - 1 : files.length - 1
      setCurrentFileIndex(newIndex)
      setActiveTab(files[newIndex].url)
    }
  }, [currentFileIndex, files])

  const handleNextFile = useCallback(() => {
    if (files.length > 0) {
      const newIndex = currentFileIndex < files.length - 1 ? currentFileIndex + 1 : 0
      setCurrentFileIndex(newIndex)
      setActiveTab(files[newIndex].url)
    }
  }, [currentFileIndex, files])

  // Actualizar índice cuando cambia la pestaña activa
  useEffect(() => {
    const index = files.findIndex((file) => file.url === activeTab)
    if (index !== -1) {
      setCurrentFileIndex(index)
    }
  }, [activeTab, files])

  const activeFile = files.find((file) => file.url === activeTab)

  if (files.length === 0) {
    return (
      <div className={`h-full flex flex-col bg-background z-50 ${isMobile ? "fixed inset-0" : ""}`}>
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-border">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Código Generado</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-muted">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
          <div className="text-center">
            <FileCode className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm sm:text-base">No hay archivos de código disponibles</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col bg-background z-50 ${isMobile ? "fixed inset-0" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-border">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">
            {isMobile ? "Código" : "Código Generado"}
          </h2>
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            {files.length} archivo{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-8 w-8 hover:bg-muted"
              title={isExpanded ? "Contraer" : "Expandir"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-muted">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navegación de archivos */}
      {isMobile && files.length > 1 ? (
        // Navegación móvil con botones
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousFile}
            className="h-8 px-2"
            disabled={files.length <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <FileCode className="h-4 w-4" />
              <span className="text-sm font-medium truncate max-w-[150px]" title={activeFile?.filePath}>
                {activeFile?.fileName}
              </span>
              {activeFile?.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              {activeFile?.error && <AlertCircle className="h-3 w-3 text-destructive" />}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {currentFileIndex + 1} de {files.length}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleNextFile} className="h-8 px-2" disabled={files.length <= 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : !isMobile ? (
        // Tabs para desktop
        <div className="border-b border-border">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-auto overflow-x-auto">
              {files.map((file) => (
                <TabsTrigger
                  key={file.url}
                  value={file.url}
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span
                      className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[150px]"
                      title={file.filePath}
                    >
                      {file.fileName}
                    </span>
                    {file.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                    {file.error && <AlertCircle className="h-3 w-3 text-destructive" />}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeFile && (
          <div className="h-full flex flex-col">
            {/* File info bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2 bg-muted/30 border-b border-border gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <span className="capitalize">{activeFile.language}</span>
                {isMobile && <span className="text-xs text-muted-foreground">• {activeFile.fileName}</span>}
              </div>

              {activeFile.content && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyCode(activeFile.content!, activeFile.fileName)}
                    className={`${isMobile ? "h-7 px-2 text-xs" : "h-8 px-3"} hover:bg-muted`}
                  >
                    {copied === activeFile.fileName ? (
                      <>
                        <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1 sm:mr-2" />
                        {isMobile ? "✓" : "Copiado"}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        {isMobile ? "Copiar" : "Copiar"}
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadFile(activeFile.content!, activeFile.fileName)}
                    className={`${isMobile ? "h-7 px-2 text-xs" : "h-8 px-3"} hover:bg-muted`}
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {isMobile ? "Desc." : "Descargar"}
                  </Button>
                </div>
              )}
            </div>

            {/* Code editor or loading/error state */}
            <div className="flex-1 overflow-hidden">
              {activeFile.loading ? (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-sm sm:text-base text-muted-foreground">Cargando {activeFile.fileName}...</p>
                  </div>
                </div>
              ) : activeFile.error ? (
                <div className="h-full flex items-center justify-center p-4 sm:p-6">
                  <Alert className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="mt-2">
                      <div className="space-y-2">
                        <p className="text-sm">Error al cargar {activeFile.fileName}:</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{activeFile.error}</p>
                        <div className="mt-3 space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetryLoad(files.findIndex((f) => f.url === activeFile.url))}
                            className="w-full sm:w-auto"
                          >
                            Reintentar
                          </Button>
                          {!isMobile && (
                            <div className="text-xs text-muted-foreground">
                              <p>URL: {activeFile.url}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : activeFile.content ? (
                <div className="h-full">
                  <Editor
                    height="100%"
                    language={activeFile.language}
                    value={activeFile.content}
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    options={{
                      readOnly: true,
                      minimap: { enabled: !isMobile && isExpanded },
                      fontSize: isMobile ? 12 : 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: "on",
                      folding: true,
                      lineDecorationsWidth: isMobile ? 5 : 10,
                      lineNumbersMinChars: isMobile ? 2 : 3,
                      glyphMargin: false,
                      scrollbar: {
                        vertical: "auto",
                        horizontal: "auto",
                        verticalScrollbarSize: isMobile ? 8 : 12,
                        horizontalScrollbarSize: isMobile ? 8 : 12,
                      },
                      overviewRulerLanes: isMobile ? 0 : 3,
                    }}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground p-4">
                  <div className="text-center">
                    <FileCode className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">No se pudo cargar el contenido del archivo</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CodeCanvas
