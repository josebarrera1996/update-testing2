"use client"

import { memo, useCallback, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Pencil, Copy, Check, RefreshCcw, AlertCircle, FileText, Download, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { PredictiveUserProps, Attachment } from "./PredictiveTypes"
import { cn } from "@/lib/utils"
import { EditMessage } from "./EditMessage"

interface S3FileUrls {
  [key: string]: string
}

interface S3UrlResult {
  fileKey: string
  url: string
}

interface ExtendedPredictiveUserProps extends PredictiveUserProps {
  onEdit?: () => void
  isEditing?: boolean
  editedContent?: string
  setEditedContent?: (content: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  isEditLoading?: boolean
}

export const PredictiveUser = memo(
  ({
    content,
    onRetry,
    onEdit,
    error,
    errorMessage,
    attachments = [],
    timestamp,
    isOptimistic = false,
    isEditing = false,
    editedContent = "",
    setEditedContent,
    onSaveEdit,
    onCancelEdit,
    isEditLoading = false,
  }: ExtendedPredictiveUserProps) => {
    const [copied, setCopied] = useState(false)
    const [s3FileUrls, setS3FileUrls] = useState<S3FileUrls>({})
    const [loadingFiles, setLoadingFiles] = useState<boolean>(false)
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
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

    // Función para obtener URLs firmadas de S3 para todos los archivos
    const fetchS3FileUrls = useCallback(async () => {
      if (isOptimistic) return

      const fileAttachments = attachments.filter((att) => att.fileKey && att.fileKey.length > 0)

      if (fileAttachments.length === 0) return

      setLoadingFiles(true)

      try {
        const urlPromises = fileAttachments.map(async (attachment) => {
          if (!attachment.fileKey) return null

          const response = await fetch("/api/s3-get-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey: attachment.fileKey }),
          })

          if (!response.ok) {
            throw new Error(`Error fetching S3 URL for ${attachment.name}`)
          }

          const { presignedUrl } = await response.json()
          return {
            fileKey: attachment.fileKey,
            url: presignedUrl,
          } as S3UrlResult
        })

        const results = await Promise.all(urlPromises)

        const newUrls: S3FileUrls = {}
        results.forEach((result) => {
          if (result && result.fileKey) {
            newUrls[result.fileKey] = result.url
          }
        })

        setS3FileUrls(newUrls)
      } catch (error) {
        console.error("Error fetching S3 file URLs:", error)
      } finally {
        setLoadingFiles(false)
      }
    }, [attachments, isOptimistic])

    // Función mejorada para descargar un archivo
    const handleDownload = useCallback(async (url: string, fileName: string) => {
      try {
        setDownloadingFile(fileName)

        const response = await fetch(url)
        const blob = await response.blob()

        const objectUrl = URL.createObjectURL(blob)

        const link = document.createElement("a")
        link.href = objectUrl
        link.download = fileName
        link.style.display = "none"
        document.body.appendChild(link)

        link.click()

        URL.revokeObjectURL(objectUrl)
        document.body.removeChild(link)
      } catch (error) {
        console.error("Error downloading file:", error)
        alert("No se pudo descargar el archivo. Intente abrir en nueva pestaña.")
      } finally {
        setDownloadingFile(null)
      }
    }, [])

    // Función para abrir archivo en nueva pestaña
    const handleOpenInNewTab = useCallback((url: string) => {
      window.open(url, "_blank")
    }, [])

    // Cargar URLs de S3 cuando hay attachments
    useEffect(() => {
      if (attachments.some((att) => att.fileKey) && !isOptimistic) {
        fetchS3FileUrls()
      }
    }, [attachments, fetchS3FileUrls, isOptimistic])

    const handleCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error("Failed to copy:", err)
      }
    }, [content])

    const handleEditClick = useCallback(() => {
      console.log("🖊️ Botón de editar clickeado", { onEdit, isOptimistic })
      if (onEdit && !isOptimistic) {
        onEdit()
      }
    }, [onEdit, isOptimistic])

    // Función para renderizar un attachment
    const renderAttachment = (attachment: Attachment, index: number) => {
      if (isOptimistic) {
        return (
          <div
            key={index}
            className="flex items-center gap-2 bg-background/80 rounded-lg p-2 text-xs mt-2 animate-pulse"
          >
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-muted-foreground" />
            <span className="truncate flex-grow text-muted-foreground text-xs sm:text-sm">{attachment.name}</span>
          </div>
        )
      }

      const isImage = attachment.type.startsWith("image/")
      const s3Url = attachment.fileKey && s3FileUrls[attachment.fileKey]
      const isDownloading = downloadingFile === attachment.name

      if (isImage && s3Url) {
        return (
          <div key={index} className="mt-2 relative">
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={s3Url || "/placeholder.svg"}
                alt={attachment.name}
                className="max-w-full h-auto rounded-lg object-contain"
                style={{ maxHeight: isMobile ? "200px" : "300px" }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground truncate max-w-[70%]">{attachment.name}</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 sm:h-6 sm:w-6 rounded-full hover:bg-muted/50 p-1"
                  onClick={() => handleOpenInNewTab(s3Url)}
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div key={index} className="flex items-center gap-2 bg-background rounded-lg p-2 text-xs mt-2">
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="truncate flex-grow text-xs sm:text-sm">{attachment.name}</span>
          {s3Url && (
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 sm:h-6 sm:w-6 rounded-full hover:bg-muted/50 p-1"
                onClick={() => handleDownload(s3Url, attachment.name)}
                title="Descargar archivo"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <div className="h-3 w-3 sm:h-4 sm:w-4 border-2 border-t-transparent border-primary animate-spin rounded-full" />
                ) : (
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      )
    }

    // Si está en modo edición, mostrar el componente de edición
    if (isEditing && setEditedContent && onSaveEdit && onCancelEdit) {
      return (
        <div className={cn("flex flex-col items-end group")}>
          <div className="message-container relative p-3 sm:p-4 rounded-lg bg-muted/50 border-2 border-primary/20 w-full max-w-[95%] sm:max-w-[85%]">
            <EditMessage
              editedContent={editedContent}
              setEditedContent={setEditedContent}
              handleSaveEdit={onSaveEdit}
              handleCancelEdit={onCancelEdit}
              isLoading={isEditLoading}
            />
          </div>
        </div>
      )
    }

    return (
      <div className={cn("flex flex-col items-end group", isOptimistic && "opacity-80")}>
        <div
          className={cn(
            "message-container relative p-3 sm:p-4 rounded-lg w-full max-w-[95%] sm:max-w-[85%]",
            error
              ? "border-2 border-destructive bg-destructive/10"
              : isOptimistic
                ? "bg-muted text-accent-foreground border border-muted-foreground/20"
                : "bg-muted text-accent-foreground",
          )}
        >
          <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap">{content}</p>

          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {isOptimistic ? (
                attachments.map((attachment, index) => renderAttachment(attachment, index))
              ) : loadingFiles ? (
                <div className="text-xs text-muted-foreground">Cargando archivos...</div>
              ) : (
                attachments.map((attachment, index) => renderAttachment(attachment, index))
              )}
            </div>
          )}

          {error && errorMessage && (
            <div className="mt-3 p-2 bg-destructive/20 border border-destructive rounded flex items-start gap-2">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-destructive">Error al enviar mensaje</p>
            </div>
          )}
        </div>

        <div className={`flex items-center gap-1 sm:gap-2 mr-2 mt-2 ${isMobile ? "flex-wrap" : ""}`}>
          <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {timestamp && format(new Date(timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
            {isOptimistic && " (enviando...)"}
          </div>

          {!isOptimistic && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
              onClick={handleCopy}
              title="Copiar mensaje"
            >
              {copied ? (
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </Button>
          )}

          {onEdit && !isOptimistic && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
              onClick={handleEditClick}
              title="Editar mensaje"
            >
              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}

          {onRetry && !isOptimistic && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
              onClick={onRetry}
              title="Reenviar mensaje"
            >
              <RefreshCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          )}
        </div>
      </div>
    )
  },
)

PredictiveUser.displayName = "PredictiveUser"
