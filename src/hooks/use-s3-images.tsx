"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface S3ImageUrls {
  [s3Path: string]: string;
}

export const useS3Images = (content: string) => {
  const [s3ImageUrls, setS3ImageUrls] = useState<S3ImageUrls>({});
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [processedContent, setProcessedContent] = useState(content);

  // Ref para evitar loops infinitos
  const processedContentRef = useRef<string>("");
  const isProcessingRef = useRef<boolean>(false);

  // Función para extraer paths de S3 del contenido markdown - VERSIÓN ROBUSTA
  const extractS3Paths = useCallback((text: string): string[] => {
    //  console.log("🔍 Analizando contenido para paths de S3...");
    //console.log("📄 Contenido a analizar:", text.substring(0, 300) + "...");

    const s3Paths: string[] = [];

    // Método 1: Regex tradicional
    const s3ImageRegex = /!\[([^\]]*)\]$$(s3:\/\/[^)]+)$$/g;
    let match;
    s3ImageRegex.lastIndex = 0;

    while ((match = s3ImageRegex.exec(text)) !== null) {
      const s3Path = match[2].trim();
      //  console.log("📁 Path S3 encontrado (método 1):", s3Path);
      if (!s3Paths.includes(s3Path)) {
        s3Paths.push(s3Path);
      }
    }

    // Método 2: Buscar todos los s3:// y verificar si están en contexto de imagen
    if (s3Paths.length === 0) {
      // console.log("🔍 Método 1 falló, probando método 2...");

      // Encontrar todas las ocurrencias de s3://
      const allS3Matches = text.match(/s3:\/\/[^\s)]+/g);

      if (allS3Matches) {
        // console.log("🔍 Encontrados paths s3:// sueltos:", allS3Matches);

        // Para cada s3://, verificar si está precedido por ![...](
        allS3Matches.forEach((s3Path) => {
          const s3Index = text.indexOf(s3Path);
          const beforeS3 = text.substring(Math.max(0, s3Index - 50), s3Index);

          // console.log("🔍 Contexto antes de", s3Path, ":", beforeS3);

          // Verificar si hay un patrón de imagen markdown antes
          if (beforeS3.match(/!\[[^\]]*\]\($/)) {
            // console.log("✅ Confirmado como imagen markdown:", s3Path);
            if (!s3Paths.includes(s3Path)) {
              s3Paths.push(s3Path);
            }
          }
        });
      }
    }

    // Método 3: Split y buscar manualmente (último recurso)
    if (s3Paths.length === 0) {
      // console.log("🔍 Método 2 falló, probando método 3...");

      const lines = text.split("\n");
      lines.forEach((line, index) => {
        if (line.includes("![") && line.includes("](s3://")) {
          //  console.log(`🔍 Línea ${index} contiene imagen con s3:`, line);

          // Extraer manualmente el path
          const startIndex = line.indexOf("](s3://") + 2;
          const endIndex = line.indexOf(")", startIndex);

          if (startIndex > 1 && endIndex > startIndex) {
            const s3Path = line.substring(startIndex, endIndex);
            //  console.log("📁 Path S3 extraído manualmente:", s3Path);
            if (!s3Paths.includes(s3Path)) {
              s3Paths.push(s3Path);
            }
          }
        }
      });
    }

    // console.log("📋 Total de paths únicos encontrados:", s3Paths.length);
    return s3Paths;
  }, []);

  // Función para convertir path de S3 a fileKey
  const s3PathToFileKey = useCallback((s3Path: string): string => {
    try {
      // Remover el prefijo s3:// y el bucket name
      const withoutProtocol = s3Path.replace("s3://", "");
      const pathParts = withoutProtocol.split("/");

      if (pathParts.length < 2) {
        console.error("❌ Path de S3 inválido:", s3Path);
        return "";
      }

      // Remover el primer elemento (bucket name) y unir el resto
      const fileKey = pathParts.slice(1).join("/");
      //console.log("🔑 FileKey generado:", fileKey, "desde path:", s3Path);
      return fileKey;
    } catch (error) {
      console.error("❌ Error procesando path S3:", s3Path, error);
      return "";
    }
  }, []);

  // Función para obtener URLs firmadas de S3
  const fetchS3ImageUrls = useCallback(
    async (s3Paths: string[]) => {
      if (s3Paths.length === 0 || isProcessingRef.current) return;

      // console.log("🚀 Obteniendo URLs firmadas para:", s3Paths);
      setIsLoadingImages(true);
      isProcessingRef.current = true;

      try {
        const urlPromises = s3Paths.map(async (s3Path) => {
          const fileKey = s3PathToFileKey(s3Path);

          if (!fileKey) {
            console.error("❌ No se pudo generar fileKey para:", s3Path);
            return { s3Path, url: null };
          }

          //  console.log("📡 Solicitando URL firmada para fileKey:", fileKey);

          const response = await fetch("/api/s3-get-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `❌ Error HTTP ${response.status} para ${s3Path}:`,
              errorText
            );
            return { s3Path, url: null };
          }

          const { presignedUrl } = await response.json();
          // console.log("✅ URL firmada obtenida para:", s3Path);
          return { s3Path, url: presignedUrl };
        });

        const results = await Promise.all(urlPromises);

        const newUrls: S3ImageUrls = {};
        results.forEach(({ s3Path, url }) => {
          if (url) {
            newUrls[s3Path] = url;
            // console.log("💾 Guardando URL para:", s3Path);
          }
        });

        setS3ImageUrls((prev) => {
          const updated = { ...prev, ...newUrls };
          // console.log("📊 URLs de S3 actualizadas:", Object.keys(updated));
          return updated;
        });
      } catch (error) {
        console.error("❌ Error general obteniendo URLs de S3:", error);
      } finally {
        setIsLoadingImages(false);
        isProcessingRef.current = false;
      }
    },
    [s3PathToFileKey]
  );

  // Función para reemplazar paths de S3 con URLs firmadas
  const replaceS3PathsWithUrls = useCallback(
    (text: string, urls: S3ImageUrls): string => {
      let updatedText = text;
      let replacements = 0;

      Object.entries(urls).forEach(([s3Path, signedUrl]) => {
        // Escapar caracteres especiales en el path para regex
        const escapedPath = s3Path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPath, "g");

        const beforeReplace = updatedText;
        updatedText = updatedText.replace(regex, signedUrl);

        if (beforeReplace !== updatedText) {
          replacements++;
          /* console.log(
            "🔄 Reemplazado:",
            s3Path,
            "→",
            signedUrl.substring(0, 50) + "..."
          );*/
        }
      });

      // console.log(`✨ Total de reemplazos realizados: ${replacements}`);
      return updatedText;
    },
    []
  );

  // Efecto para procesar el contenido cuando cambia - MEJORADO para evitar loops
  useEffect(() => {
    // Evitar procesamiento si el contenido no ha cambiado realmente
    if (processedContentRef.current === content || isProcessingRef.current) {
      return;
    }

    //  console.log("🔄 Contenido actualizado, procesando...");
    const s3Paths = extractS3Paths(content);

    if (s3Paths.length > 0) {
      // Verificar si ya tenemos URLs para todos los paths
      const missingPaths = s3Paths.filter((path) => !s3ImageUrls[path]);
      /* console.log(
        "⏳ Paths faltantes:",
        missingPaths.length,
        "de",
        s3Paths.length
      );*/

      if (missingPaths.length > 0) {
        fetchS3ImageUrls(missingPaths);
      } else {
        // Si ya tenemos todas las URLs, procesar el contenido inmediatamente
        const updatedContent = replaceS3PathsWithUrls(content, s3ImageUrls);
        setProcessedContent(updatedContent);
        processedContentRef.current = updatedContent;
      }
    } else {
      // console.log("ℹ️ No se encontraron paths de S3 en el contenido");
      setProcessedContent(content);
      processedContentRef.current = content;
    }
  }, [
    content,
    extractS3Paths,
    fetchS3ImageUrls,
    s3ImageUrls,
    replaceS3PathsWithUrls,
  ]);

  // Efecto para actualizar el contenido procesado cuando cambian las URLs - MEJORADO
  useEffect(() => {
    if (Object.keys(s3ImageUrls).length > 0) {
      const updatedContent = replaceS3PathsWithUrls(content, s3ImageUrls);

      // Solo actualizar si realmente cambió
      if (updatedContent !== processedContentRef.current) {
        setProcessedContent(updatedContent);
        processedContentRef.current = updatedContent;
        // console.log("📝 Contenido procesado actualizado");
      }
    }
  }, [s3ImageUrls, content, replaceS3PathsWithUrls]);

  return {
    processedContent,
    isLoadingImages,
    hasS3Images: Object.keys(s3ImageUrls).length > 0,
  };
};
