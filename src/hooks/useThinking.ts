"use client";

import { useState, useEffect, useRef } from "react";

interface UseThinkingParams {
  sessionId: string | null;
  versionId: number;
  isThinkingActive: boolean; // ⭐ YA ES BOOLEAN DIRECTO
  hookInstance?: string; // Opcional para debugging
}

interface ThinkingState {
  content: string;
  isThinking: boolean;
  isComplete: boolean;
}

export function useThinking({
  sessionId,
  versionId,
  isThinkingActive,
  hookInstance,
}: UseThinkingParams) {
  const [thinkingState, setThinkingState] = useState<ThinkingState>({
    content: "",
    isThinking: false,
    isComplete: false,
  });

  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialFetchDoneRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 10; // ✅ Aumentar número de reintentos

  useEffect(() => {
    /*console.log(`🧠 useThinking useEffect triggered (${hookInstance}):`, {
      sessionId,
      versionId,
      isThinkingActive,
      hasSessionId: !!sessionId,
    });*/

    setThinkingState({
      content: "",
      isThinking: !!(sessionId && isThinkingActive),
      isComplete: false,
    });

    initialFetchDoneRef.current = false;
    retryCountRef.current = 0;

    if (!sessionId || !isThinkingActive) {
      /*console.log(
        `🧠 No se procede (${hookInstance}): sessionId o isThinkingActive es falso`
      );*/
      return;
    }

    // ✅ FUNCIÓN MEJORADA CON MEJOR MANEJO DE ERRORES
    const fetchThinkingData = async () => {
      try {
        retryCountRef.current++;
        console.log(
          `🔍 Buscando thinking (${hookInstance}) intento ${retryCountRef.current}/${maxRetries} para sessionId: ${sessionId}, versionId: ${versionId}`
        );

        const response = await fetch(
          `/api/thinking?sessionId=${sessionId}&versionId=${versionId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            // ✅ Agregar timeout para evitar requests colgados
            signal: AbortSignal.timeout(10000), // 10 segundos timeout
          }
        );

        if (!response.ok) {
          throw new Error(
            `Error HTTP! estado: ${response.status} - ${response.statusText}`
          );
        }

        const data = await response.json();

        console.log(`📊 Respuesta thinking (${hookInstance}):`, {
          hasContent: !!data.content,
          contentLength: data.content?.length || 0,
          isComplete: data.isComplete,
          attempt: retryCountRef.current,
        });

        if (data.content || !initialFetchDoneRef.current) {
          setThinkingState((prev) => ({
            ...prev,
            content: data.content || prev.content,
            isThinking: !data.isComplete,
            isComplete: data.isComplete,
          }));
        }

        initialFetchDoneRef.current = true;

        // ✅ Si no está completo y no hemos excedido los reintentos, continuar
        if (!data.isComplete && retryCountRef.current < maxRetries) {
          // ✅ Usar backoff exponencial con jitter
          const baseDelay = Math.min(
            1000 * Math.pow(1.5, retryCountRef.current - 1),
            10000
          );
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;

          console.log(
            `⏳ Programando siguiente fetch en ${Math.round(delay)}ms`
          );
          fetchTimeoutRef.current = setTimeout(fetchThinkingData, delay);
        } else if (retryCountRef.current >= maxRetries) {
          console.warn(
            `⚠️ Máximo de reintentos alcanzado para thinking (${hookInstance})`
          );
          setThinkingState((prev) => ({
            ...prev,
            isThinking: false,
            isComplete: true,
          }));
        }
      } catch (error) {
        console.error(
          `❌ Error al obtener datos de thinking (${hookInstance}) intento ${retryCountRef.current}:`,
          error
        );

        // ✅ Solo reintentar si no hemos excedido el límite
        if (retryCountRef.current < maxRetries) {
          const delay = Math.min(2000 * retryCountRef.current, 15000); // Delay más agresivo en errores
          console.log(`🔄 Reintentando thinking en ${delay}ms debido a error`);
          fetchTimeoutRef.current = setTimeout(fetchThinkingData, delay);
        } else {
          console.error(
            `💥 Máximo de reintentos alcanzado después de errores (${hookInstance})`
          );
          setThinkingState((prev) => ({
            ...prev,
            isThinking: false,
            isComplete: true,
          }));
        }
      }
    };

    // ✅ Iniciar el primer fetch con un pequeño delay
    fetchTimeoutRef.current = setTimeout(fetchThinkingData, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [sessionId, versionId, isThinkingActive, hookInstance, maxRetries]);

  const finishThinking = () => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    setThinkingState((prev) => ({
      ...prev,
      isThinking: false,
      isComplete: true,
    }));
  };

  return {
    thinkingContent: thinkingState.content,
    isThinking: thinkingState.isThinking,
    isThinkingComplete: thinkingState.isComplete,
    finishThinking,
  };
}
