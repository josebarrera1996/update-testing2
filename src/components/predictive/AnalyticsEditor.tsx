"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Editor } from "@monaco-editor/react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Check, Copy, Download, FileText, Maximize2, Minimize2, X } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "../ui/switch"
import { useTheme } from "@/context/ThemeContext"

type ViewType = "researcher" | "preprocessor" | "ml-engineer" | "bi"

interface Version {
  id: string
  project_id: string
  session_id: string
  version_id: number
  input: any
  output: any
  created_at: string
  version_agent_id: number
  url_attachment: string | null
}

interface AgentData {
  research: any | null
  preprocessing: {
    url: string | null
    data: any
  } | null
  programming: {
    codigo: string
    explicacion: string
    resultado_codigo?: string
    url_attachment: string | null
  } | null
  visualization: {
    url: string | null
    data: any
  } | null
}

interface AnalyticsEditorProps {
  agentOutput: any
  projectId: string
  sessionId: string
  versionId?: number
  userId: string
  onClose: () => void
  isExpanded?: boolean
  onToggleExpand: () => void
}

export function AnalyticsEditor({
  agentOutput,
  projectId,
  sessionId,
  versionId,
  userId,
  onClose,
  isExpanded,
  onToggleExpand,
}: AnalyticsEditorProps) {
  const supabase = createClient()
  const [versions, setVersions] = useState<Version[]>([])
  const [totalVersions, setTotalVersions] = useState<number>(0)
  const [selectedVersion, setSelectedVersion] = useState<string>(versionId?.toString() || "0")
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [currentOutput, setCurrentOutput] = useState(agentOutput)
  const { theme } = useTheme()
  const [viewType, setViewType] = useState<ViewType>("researcher")
  const [enabledTabs, setEnabledTabs] = useState<Record<ViewType, boolean>>({
    researcher: false,
    preprocessor: false,
    "ml-engineer": false,
    bi: false,
  })

  const [agentData, setAgentData] = useState<AgentData>({
    research: null,
    preprocessing: {
      url: null,
      data: null,
    },
    programming: null,
    visualization: {
      url: null,
      data: null,
    },
  })

  const checkVersionHasResponses = async (sessionId: string, versionId: number) => {
    try {
      const { data, error } = await supabase
        .from("aria_combined_agents_view")
        .select("version_research, version_prep, url_prep, version_prog, url_prog, version_bi, url_bi")
        .eq("session_id", sessionId)
        .eq("version_id", versionId)

      if (error || !data || data.length === 0) return false

      return data.some((row) => Object.values(row).some((value) => value !== null))
    } catch (error) {
      console.error("Error checking version responses:", error)
      return false
    }
  }

  useEffect(() => {
    const loadData = async () => {
      if (!sessionId) return

      try {
        const { data, error } = await supabase
          .from("aria_predictive_chats")
          .select("version_id")
          .eq("session_id", sessionId)
          .single()

        if (error) throw error

        if (data) {
          setTotalVersions(data.version_id)

          const versionsPromises = Array.from({ length: data.version_id + 1 }, async (_, index) => {
            const hasResponses = await checkVersionHasResponses(sessionId, index)
            if (hasResponses) {
              const version: Version = {
                id: index.toString(),
                version_id: index,
                created_at: new Date().toISOString(),
                project_id: projectId,
                session_id: sessionId,
                input: {},
                output: {},
                version_agent_id: index,
                url_attachment: null,
              }
              return version
            }
            return null
          })

          const versionResults = await Promise.all(versionsPromises)
          const availableVersions = versionResults.filter((v): v is Version => v !== null)

          setVersions(availableVersions)

          if (versionId !== undefined) {
            const hasResponses = await checkVersionHasResponses(sessionId, versionId)
            if (hasResponses) {
              setSelectedVersion(versionId.toString())
              await loadAgentData(versionId.toString())
            } else {
              console.log("Initial version has no responses")
            }
          }
        }
      } catch (error) {
        console.error("Error loading versions:", error)
      }
    }

    loadData()
  }, [sessionId, projectId, versionId])

  useEffect(() => {
    if (selectedVersion) {
      loadAgentData(selectedVersion)
      checkEnabledTabs(sessionId, Number.parseInt(selectedVersion))
    }
  }, [selectedVersion])

  const checkEnabledTabs = async (sessionId: string, versionId: number) => {
    try {
      const { data, error } = await supabase
        .from("aria_combined_agents_view")
        .select("version_research, version_prep, url_prep, version_prog, url_prog, version_bi, url_bi")
        .eq("session_id", sessionId)
        .eq("version_id", versionId)

      if (error) {
        console.error("Error checking enabled tabs:", error)
        return
      }

      if (!data || data.length === 0) {
        setEnabledTabs({
          researcher: false,
          preprocessor: false,
          "ml-engineer": false,
          bi: false,
        })
        return
      }

      const hasResponses = {
        researcher: data.some((row) => row.version_research !== null),
        preprocessor: data.some((row) => row.version_prep !== null || row.url_prep !== null),
        "ml-engineer": data.some((row) => row.version_prog !== null || row.url_prog !== null),
        bi: data.some((row) => row.version_bi !== null || row.url_bi !== null),
      }

      setEnabledTabs(hasResponses)

      const firstEnabledTab = Object.entries(hasResponses).find(([_, enabled]) => enabled)

      if (firstEnabledTab) {
        setViewType(firstEnabledTab[0] as ViewType)
      }
    } catch (error) {
      console.error("Error in checkEnabledTabs:", error)
      setEnabledTabs({
        researcher: false,
        preprocessor: false,
        "ml-engineer": false,
        bi: false,
      })
    }
  }

  const loadAgentData = async (version: string) => {
    try {
      const [biData, researchData, programmingData, preprocessorData] = await Promise.all([
        supabase
          .from("aria_agent_bi")
          .select("*")
          .eq("session_id", sessionId)
          .eq("version_id", Number.parseInt(version))
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("aria_agent_research")
          .select("*")
          .eq("session_id", sessionId)
          .eq("version_id", Number.parseInt(version))
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("aria_agent_programming")
          .select("*")
          .eq("session_id", sessionId)
          .eq("version_id", Number.parseInt(version))
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("aria_agent_preprocesador")
          .select("*")
          .eq("session_id", sessionId)
          .eq("version_id", Number.parseInt(version))
          .order("created_at", { ascending: false })
          .limit(1),
      ])

      let biUrl: string | null = null
      let preprocessorUrl: string | null = null
      let mlEngineerUrl: string | null = null

      if (biData.data?.[0]?.url_attachment) {
        biUrl = await processImageUrl(biData.data[0].url_attachment)
      }

      if (preprocessorData.data?.[0]?.url_attachment) {
        preprocessorUrl = await processImageUrl(preprocessorData.data[0].url_attachment)
      }

      if (programmingData.data?.[0]?.url_attachment) {
        mlEngineerUrl = await processImageUrl(programmingData.data[0].url_attachment)
      }

      setAgentData({
        research: researchData.data?.[0]?.output || null,
        preprocessing: {
          url: preprocessorUrl,
          data: preprocessorData.data?.[0]?.output || null,
        },
        programming: {
          ...programmingData.data?.[0]?.output,
          url_attachment: mlEngineerUrl,
        },
        visualization: {
          url: biUrl,
          data: biData.data?.[0]?.output || null,
        },
      })
    } catch (error) {
      console.error("Error loading agent data:", error)
      setAgentData({
        research: null,
        preprocessing: { url: null, data: null },
        programming: null,
        visualization: { url: null, data: null },
      })
    }
  }

  const processImageUrl = async (url_attachment: string) => {
    try {
      if (url_attachment.includes("token=")) {
        return url_attachment
      }

      const urlParts = url_attachment.split("/storage/v1/object/sign/")
      if (urlParts.length < 2) {
        console.error("URL format is not as expected:", url_attachment)
        return null
      }

      const realPath = urlParts[1].split("?")[0]

      const { data, error } = await supabase.storage.from("aria_predictive_attachments").createSignedUrl(realPath, 3600)

      if (error) {
        console.error("Error creating signed URL:", error)

        const { data: publicUrlData } = await supabase.storage
          .from("aria_predictive_attachments")
          .getPublicUrl(realPath)

        return publicUrlData.publicUrl
      }

      return data.signedUrl
    } catch (error) {
      console.error("Error in processImageUrl:", error)
      return null
    }
  }

  const handleVersionChange = (value: string) => {
    console.log("Version changed to:", value)
    setSelectedVersion(value)
    loadAgentData(value)
  }

  const renderVersionSelect = () => {
    return (
      <Select value={selectedVersion} onValueChange={handleVersionChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Seleccionar versión" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((version) => (
            <SelectItem key={version.id} value={version.version_id.toString()}>
              {`Versión ${version.version_id}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const PreprocessorViewer: React.FC<{
    url: string | null
    data?: any
    theme: string
  }> = ({ url, data, theme }) => {
    const [downloading, setDownloading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const explanation = data?.explicacion || null

    const fileName = url ? url.split("/").pop()?.split("?")[0] || "data.csv" : "data.csv"

    const handleDownload = async () => {
      if (!url) return

      try {
        setDownloading(true)
        const response = await fetch(url)
        if (!response.ok) throw new Error("Network response was not ok")
        const blob = await response.blob()

        const link = document.createElement("a")
        link.href = window.URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(link.href)

        setTimeout(() => setDownloading(false), 1000)
      } catch (err) {
        console.error("Error downloading file:", err)
        setError("Error al descargar el archivo")
        setDownloading(false)
      }
    }

    return (
      <div className="h-full w-full flex flex-col bg-background p-4 sm:p-6">
        <div className="flex-1 overflow-auto pb-4">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Explicación</h3>
          <div className={`prose ${theme === "dark" ? "prose-invert" : ""} max-w-none`}>
            {explanation ? (
              explanation.split("\n").map((line: string, index: number) => (
                <p key={index} className="mb-2">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No hay explicación disponible para este procesamiento</p>
            )}
          </div>
        </div>

        {url && (
          <div className="mt-auto">
            <div
              className={`flex flex-col sm:flex-row items-center justify-between p-3 ${
                theme == "dark" ? "bg-card" : "bg-muted"
              } rounded-lg gap-3`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
                className="hover:bg-background h-8 px-4"
              >
                {downloading ? (
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {downloading ? "Descargado" : "Descargar"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2 text-center">{error}</p>}
          </div>
        )}
      </div>
    )
  }

  const ImageViewer: React.FC<{
    url: string | null
    data?: any
  }> = ({ url, data }) => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [showCode, setShowCode] = useState(false)

    const explanation = data?.explicacion || null
    const code = data?.codigo || null

    const handleDownload = async () => {
      if (!url) return

      try {
        setDownloading(true)
        const response = await fetch(url)
        if (!response.ok) throw new Error("Network response was not ok")
        const blob = await response.blob()

        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split("/")
        let fileName = pathParts[pathParts.length - 1]

        if (!fileName.match(/\.(png|jpg|jpeg|gif)$/i)) {
          const fileType = blob.type.split("/")[1]
          fileName += `.${fileType || "png"}`
        }

        const link = document.createElement("a")
        link.href = window.URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        window.URL.revokeObjectURL(link.href)
        setTimeout(() => setDownloading(false), 1000)
      } catch (err) {
        console.error("Error downloading image:", err)
        setError("Error al descargar la imagen")
        setDownloading(false)
      }
    }

    if (!url) {
      return (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          No hay visualización disponible
        </div>
      )
    }

    return (
      <div className="h-full w-full flex flex-col bg-background">
        {/* Imagen */}
        <div
          className={`relative flex items-center justify-center p-2 sm:p-4 transition-[height] duration-300 ease-in-out ${
            showCode ? "h-[50%]" : "h-[60%] sm:h-[70%]"
          }`}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
          <img
            src={url || "/placeholder.svg"}
            alt="Visualización"
            className="max-h-full max-w-full object-contain"
            onLoad={() => setLoading(false)}
            onError={(e) => {
              console.error("Error loading image:", e)
              setLoading(false)
              setError("Error al cargar la imagen")
            }}
            style={{ display: loading ? "none" : "block" }}
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-destructive text-center px-4">
              {error}
            </div>
          )}

          {!loading && !error && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 sm:bottom-6 sm:right-6 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={handleDownload}
              title="Descargar imagen"
            >
              {downloading ? <Check className="h-4 w-4 text-green-500" /> : <Download className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Explicación/Código */}
        <div
          className={`border-t border-border bg-background transition-[height] duration-300 ease-in-out ${
            showCode ? "h-[50%]" : "h-[40%] sm:h-[30%]"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 border-b border-border gap-2">
            <h3 className="text-lg font-semibold text-foreground">{showCode ? "Código" : "Explicación"}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Mostrar código</span>
              <Switch checked={showCode} onCheckedChange={setShowCode} id="show-code" />
            </div>
          </div>

          <div className="overflow-auto h-[calc(100%-57px)] sm:h-[calc(100%-49px)]">
            {showCode ? (
              code ? (
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={code}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay código disponible
                </div>
              )
            ) : (
              <div className={`p-4 sm:p-6 prose ${theme === "dark" ? "prose-invert" : ""} max-w-none`}>
                {explanation ? (
                  explanation.split("\n").map((line: string, index: number) => (
                    <p key={index} className="mb-2">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground">No hay explicación disponible para esta visualización</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const ResearchViewer: React.FC<{ content: string; theme: string }> = ({ content, theme }) => {
    const processContent = (xmlContent: string) => {
      const mainContent = xmlContent.replace(/<\/?respuesta>/g, "").trim()
      const sections = mainContent.split(/(?=<\w+>)/)

      return sections
        .map((section) => {
          const titleMatch = section.match(/<(\w+)>([\s\S]*?)<\/\1>/)
          if (!titleMatch) return null

          const [, tag, content] = titleMatch
          const title = tag.replace(/_/g, " ").toUpperCase()

          const formattedContent = content
            .trim()
            .split(/\n/)
            .map((line) => {
              line = line.trim()
              if (line.match(/^Fase \d+[-.]/)) {
                return `<h4 class="mt-4 mb-2 font-semibold">${line}</h4>`
              }
              if (line.startsWith("-")) {
                return `<li>${line.substring(1).trim()}</li>`
              }
              if (line.match(/^[a-z]\)/)) {
                return `<li>${line.substring(2).trim()}</li>`
              }
              if (!line) {
                return "<br/>"
              }
              return `<p>${line}</p>`
            })
            .join("\n")

          return {
            title,
            content: formattedContent,
          }
        })
        .filter((item): item is { title: string; content: string } => item !== null)
    }

    const sections = processContent(content)

    return (
      <div className="h-full overflow-auto p-4 sm:p-6 bg-background text-foreground">
        {sections.map((section, index) => (
          <div key={index} className="mb-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 text-foreground">
              {index + 1}. {section.title}
            </h3>
            <div
              className={`prose ${theme === "dark" ? "prose-invert" : ""} max-w-none prose-sm sm:prose-base`}
              dangerouslySetInnerHTML={{
                __html: section.content
                  .replace(/<li>/g, '<li class="mb-2">')
                  .replace(/<ul>/g, '<ul class="list-disc pl-6 my-4">')
                  .replace(/<ol>/g, '<ol class="list-decimal pl-6 my-4">')
                  .replace(/<p>/g, '<p class="mb-3">')
                  .replace(/<br\/>/g, '<div class="h-3"></div>'),
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  const ProgrammingViewer: React.FC<{
    content: {
      codigo?: string
      explicacion?: string
      resultado_codigo?: string
      url_attachment?: string | null
    }
    theme: string
  }> = ({ content, theme }) => {
    const { codigo = "", explicacion = "", resultado_codigo, url_attachment } = content
    const [copied, setCopied] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleCopyCode = async () => {
      if (!codigo) return
      try {
        await navigator.clipboard.writeText(codigo)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error("Error copying code:", err)
      }
    }

    const handleDownloadPickle = async () => {
      if (!url_attachment) return
      try {
        setDownloading(true)
        const response = await fetch(url_attachment)
        if (!response.ok) throw new Error("Network response was not ok")
        const blob = await response.blob()

        const fileName = url_attachment.split("/").pop()?.split("?")[0] || "model.pkl"

        const link = document.createElement("a")
        link.href = window.URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(link.href)

        setTimeout(() => setDownloading(false), 1000)
      } catch (err) {
        console.error("Error downloading pickle:", err)
        setError("Error al descargar el archivo")
        setDownloading(false)
      }
    }

    if (!codigo && !explicacion) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          No hay datos de programación disponibles
        </div>
      )
    }

    return (
      <div className="h-full overflow-hidden flex flex-col">
        {/* Código */}
        <div className="flex-1 relative">
          {codigo && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={handleCopyCode}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}

          <Editor
            height="100%"
            defaultLanguage="python"
            value={codigo}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Botón de descarga del pickle */}
        {url_attachment && (
          <div className="flex justify-center sm:justify-end px-4 sm:px-6 py-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPickle}
              disabled={downloading}
              className="w-full sm:w-auto bg-transparent"
            >
              {downloading ? (
                <>
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Descargado
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar modelo
                </>
              )}
            </Button>
          </div>
        )}

        {/* Explicación y Resultado */}
        <div className="h-[40%] border-t border-border bg-background overflow-auto">
          <div className="p-4 sm:p-6">
            {explicacion && (
              <>
                <h3 className="text-lg font-semibold mb-4 text-foreground">Explicación</h3>
                <div className={`prose ${theme === "dark" ? "prose-invert" : ""} max-w-none prose-sm sm:prose-base`}>
                  {explicacion.split("\n").map((line: string, index: number) => (
                    <p key={index} className="mb-2 text-foreground">
                      {line}
                    </p>
                  ))}
                </div>
              </>
            )}

            {resultado_codigo && (
              <>
                <h3 className="text-lg font-semibold mb-4 mt-6 text-foreground">Resultado</h3>
                <div className={`prose ${theme === "dark" ? "prose-invert" : ""} max-w-none prose-sm sm:prose-base`}>
                  <p className="text-foreground">{resultado_codigo}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (viewType) {
      case "researcher":
        return agentData.research ? (
          <ResearchViewer content={agentData.research} theme={theme} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No hay datos de investigación disponibles
          </div>
        )
      case "preprocessor": {
        const preprocessorUrl = agentData.preprocessing?.url || null
        return <PreprocessorViewer url={preprocessorUrl} data={agentData.preprocessing?.data || null} theme={theme} />
      }
      case "ml-engineer":
        return agentData.programming ? (
          <ProgrammingViewer content={agentData.programming} theme={theme} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No hay datos de programación disponibles
          </div>
        )
      case "bi":
        return <ImageViewer url={agentData.visualization?.url || null} data={agentData.visualization?.data || null} />
    }
  }

  return (
    <div className={`h-full flex flex-col bg-background`}>
      <div className={`flex flex-col border-b border-border`}>
        {/* Header con controles principales */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-2 gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {renderVersionSelect()}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-8 w-8 ml-auto sm:ml-0"
              title={isExpanded ? "Contraer" : "Expandir"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs y botón de commit */}
        <div className="px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <Tabs defaultValue="researcher" value={viewType} onValueChange={(value) => setViewType(value as ViewType)}>
            <TabsList
              className={`${theme == "dark" ? "bg-card" : "bg-muted"} overflow-x-auto whitespace-nowrap w-full sm:w-auto`}
            >
              <TabsTrigger
                value="researcher"
                disabled={!enabledTabs.researcher}
                className={!enabledTabs.researcher ? "opacity-50 cursor-not-allowed" : ""}
              >
                Researcher
              </TabsTrigger>
              <TabsTrigger
                value="preprocessor"
                disabled={!enabledTabs.preprocessor}
                className={!enabledTabs.preprocessor ? "opacity-50 cursor-not-allowed" : ""}
              >
                Preprocessor
              </TabsTrigger>
              <TabsTrigger
                value="ml-engineer"
                disabled={!enabledTabs["ml-engineer"]}
                className={!enabledTabs["ml-engineer"] ? "opacity-50 cursor-not-allowed" : ""}
              >
                ML Engineer
              </TabsTrigger>
              <TabsTrigger
                value="bi"
                disabled={!enabledTabs.bi}
                className={!enabledTabs.bi ? "opacity-50 cursor-not-allowed" : ""}
              >
                BI
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCommitModal(true)}
            className="relative h-8 px-4 overflow-hidden rounded-md hover:bg-background transition-colors !border-[#4262ff] w-full sm:w-auto"
          >
            <span className="relative text-sm font-medium flex items-center gap-2 text-foreground">Crear Commit</span>
          </Button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}
