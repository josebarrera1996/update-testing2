// hooks/usePredictiveFiles.ts
import { useState, useCallback } from "react";
import type { Attachment } from "@/components/predictive/PredictiveTypes";
import type {
  UsePredictiveFilesParams,
  UsePredictiveFilesReturn,
} from "./PredictiveHookTypes";
import imageCompression from "browser-image-compression";
const Compressor = require("compressorjs");

export function usePredictiveFiles({
  userId,
  sessionId,
}: UsePredictiveFilesParams): UsePredictiveFilesReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Función para comprimir imágenes
  const compressImage = useCallback(async (file: File): Promise<File> => {
    if (
      !file.type.startsWith("image/") &&
      !/\.(jpe?g|png|gif|jfif)$/i.test(file.name)
    ) {
      return file;
    }

    try {
      console.log(
        "Procesando imagen original:",
        file.name,
        "Tamaño:",
        file.size
      );

      const fileType = file.name.toLowerCase().endsWith(".jfif")
        ? "image/jpeg"
        : file.type;

      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp",
      });

      return new Promise((resolve, reject) => {
        new Compressor(compressedFile, {
          quality: 0.8,
          convertSize: 100000,
          success(result: Blob) {
            const newFileName = file.name.replace(
              /\.(jpe?g|png|gif|jfif)$/i,
              ".webp"
            );
            const finalFile = new File([result], newFileName, {
              type: "image/webp",
            });
            resolve(finalFile);
          },
          error(err: Error) {
            reject(err);
          },
        });
      });
    } catch (error) {
      console.error("Error in image compression:", error);
      throw error;
    }
  }, []);

  // Función para subir archivos
  const handleFileUpload = useCallback(
    async (file: File): Promise<Attachment | undefined> => {
      try {
        const MAX_FILE_SIZE = 5242880000; // 50MB
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `El archivo excede el límite de ${(
              MAX_FILE_SIZE /
              (1024 * 1024)
            ).toFixed(0)}MB`
          );
        }

        // Procesar el archivo
        let processedFile: File;
        if (
          file.type.startsWith("image/") ||
          /\.(jpe?g|png|gif|jfif)$/i.test(file.name)
        ) {
          processedFile = await compressImage(file);
        } else {
          processedFile = file;
        }

        const fileExtension =
          processedFile.name.toLowerCase().split(".").pop() || "";
        let contentType = processedFile.type;

        // Asignar tipos MIME específicos para extensiones
        switch (fileExtension) {
          case "csv":
            contentType = "text/csv";
            break;
          case "ts":
          case "tsx":
            contentType = "application/typescript";
            break;
          case "js":
          case "jsx":
            contentType = "application/javascript";
            break;
          case "py":
            contentType = "text/x-python";
            break;
          case "sql":
            contentType = "application/sql";
            break;
          case "tf":
            contentType = "application/octet-stream"; // Tipo genérico para archivos TensorFlow
            break;
          case "webp":
            contentType = "image/webp";
            break;
          case "ipynb": // Nuevo caso para Jupyter Notebooks
            contentType = "application/x-ipynb+json";
            break;
        }

        const allowedExtensions = [
          // Extensiones existentes
          "jpg",
          "jpeg",
          "png",
          "gif",
          "pdf",
          "doc",
          "docx",
          "txt",
          "json",
          "csv",
          "xlsx",
          "xls",
          // Nuevas extensiones de código
          "ts",
          "tsx",
          "js",
          "jsx",
          "py",
          "sql",
          "tf",
          // Otras extensiones comunes de código
          "html",
          "css",
          "md",
          "xml",
          "yaml",
          "yml",
          "sh",
          "bat",
          "php",
          "c",
          "cpp",
          "h",
          "java",
          "rb",
          "go",
          "rs",
          "swift",
          // Formato WebP
          "webp",
          // Jupyter Notebook
          "ipynb",
        ];

        const allowedMimeTypes = [
          // Tipos MIME existentes
          "image/jpeg",
          "image/png",
          "image/gif",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "application/json",
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/csv",
          "text/x-csv",
          "application/x-csv",
          // Nuevos tipos MIME para código
          "application/typescript",
          "text/typescript",
          "application/javascript",
          "text/javascript",
          "text/x-python",
          "application/x-python",
          "application/sql",
          "text/x-sql",
          "application/octet-stream",
          // Tipos MIME adicionales para código
          "text/html",
          "text/css",
          "text/markdown",
          "application/xml",
          "text/xml",
          "application/yaml",
          "text/yaml",
          "application/x-sh",
          "application/x-bat",
          "application/php",
          "text/x-c",
          "text/x-c++",
          "text/x-java",
          "text/x-ruby",
          "text/x-go",
          "text/x-rust",
          "text/x-swift",
          // Formato WebP
          "image/webp",
          // Jupyter Notebook
          "application/x-ipynb+json",
        ];

        // Priorizar la validación por extensión sobre el tipo MIME
        if (!allowedExtensions.includes(fileExtension)) {
          throw new Error(
            `Tipo de archivo no permitido. Extensiones permitidas: ${allowedExtensions.join(
              ", "
            )}`
          );
        }

        // Crear adjunto temporal
        const tempAttachment: Attachment = {
          name: processedFile.name,
          type: contentType,
          file: processedFile,
          url: URL.createObjectURL(processedFile),
          uploading: true,
          uploaded: undefined,
          fileKey: "",
        };
        setAttachments((prev) => [...prev, tempAttachment]);

        // Obtener URL firmada
        const res = await fetch("/api/s3-presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: processedFile.name,
            fileType: contentType,
            sessionId: sessionId || "welcome",
            userId: userId,
          }),
        });

        const { presignedUrl, fileKey } = await res.json();

        // Subir archivo
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: processedFile,
        });

        if (!uploadRes.ok) throw new Error("Error al subir a S3");

        // Actualizar estado
        let updatedAttachment: Attachment | undefined;

        setAttachments((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex(
            (att) => att.name === processedFile.name && att.uploading
          );
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              uploading: false,
              uploaded: true,
              fileKey,
            };
            updatedAttachment = updated[idx];
          }
          return updated;
        });

        return (
          updatedAttachment || {
            name: processedFile.name,
            type: contentType,
            file: processedFile,
            url: URL.createObjectURL(processedFile),
            uploaded: true,
            uploading: false,
            fileKey,
          }
        );
      } catch (error) {
        console.error("Error processing file:", error);

        // Marcar como fallido
        setAttachments((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((att) => att.name === file.name);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              uploading: false,
              uploaded: false,
            };
          }
          return updated;
        });

        throw error;
      }
    },
    [userId, sessionId, compressImage]
  );

  // Funciones para drag & drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      try {
        await Promise.all(
          Array.from(e.dataTransfer.files).map((file) => handleFileUpload(file))
        );
      } catch (error) {
        console.error("Error al cargar archivos:", error);
      }
    },
    [handleFileUpload]
  );

  const removeAttachment = async (index: number) => {
    const file = attachments[index];
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    if (file?.fileKey && sessionId) {
      try {
        await fetch("/api/s3-delete-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKey: file.fileKey, sessionId }),
        });
      } catch (e) {
        console.error("No se pudo eliminar en S3", e);
      }
    }
  };

  // Función para limpiar todos los adjuntos
  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    isDragging,
    handleFileUpload,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    removeAttachment,
    clearAttachments,
  };
}
