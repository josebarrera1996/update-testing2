"use client";

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Message,
  Attachment,
} from "@/components/predictive/PredictiveTypes";
import type {
  AIButtonsState,
  UsePredictiveSendParams,
} from "./PredictiveHookTypes";
import { useThinking } from "./useThinking";
import { usePendingMessage } from "./usePendingMessage";

interface ButtonState {
  grammar: boolean;
  reasoning: boolean;
  tone: string;
}

export function usePredictiveSend({
  sessionId,
  projectId,
  updateMessages,
  messages,
  clearAttachments,
  onNewChat,
  onChatNameUpdate,
  calculateNextVersion,
  attachments = [],
  thinkingSession,
  isThinkingFromWelcome,
  startLoadingWatch,
  stopLoadingWatch,
  handleSendError, // ✅ NUEVO: Función para manejar errores
}: UsePredictiveSendParams & {
  startLoadingWatch?: () => void;
  stopLoadingWatch?: () => void;
  handleSendError?: (
    sessionId: string,
    errorMessage: string,
    failedMessage: Message
  ) => Promise<void>; // ✅ NUEVO
}) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiButtonsState, setAiButtonsState] = useState<AIButtonsState>({
    reasoning: false,
    search: false,
    document: false,
    agentic: false,
  });
  const [lastOptimisticMessage, setLastOptimisticMessage] =
    useState<Message | null>(null);
  const [savedThinkingContent, setSavedThinkingContent] = useState<string>("");
  const { setPending, clearPending } = usePendingMessage();

  const [currentThinkingSession, setCurrentThinkingSession] = useState<{
    sessionId: string;
    versionId: number;
  } | null>(null);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sessionId
  );
  const currentSessionRef = useRef<string | null>(sessionId);

  useEffect(() => {
    if (sessionId !== currentSessionId) {
      console.log(
        "🔄 usePredictiveSend: Session changed, resetting local loading state"
      );

      setIsLoading(false);
      setLastOptimisticMessage(null);
      setCurrentSessionId(sessionId);
      currentSessionRef.current = sessionId;

      if (
        currentThinkingSession &&
        currentThinkingSession.sessionId !== sessionId
      ) {
        console.log(
          "🧹 usePredictiveSend: Clearing thinking session for old session"
        );
        setCurrentThinkingSession(null);
      }
    }
  }, [sessionId, currentSessionId, currentThinkingSession]);

  const { thinkingContent, isThinking, isThinkingComplete, finishThinking } =
    useThinking({
      sessionId: currentThinkingSession?.sessionId || null,
      versionId: currentThinkingSession?.versionId || 0,
      isThinkingActive: Boolean(
        (aiButtonsState.reasoning || isThinkingFromWelcome) &&
          !!currentThinkingSession
      ),
    });

  useEffect(() => {
    if (thinkingContent && thinkingContent.trim()) {
      setSavedThinkingContent(thinkingContent);
    }
  }, [thinkingContent]);

  useEffect(() => {
    if (isThinkingFromWelcome && thinkingSession) {
      setCurrentThinkingSession(thinkingSession);
      setAiButtonsState({
        reasoning: true,
        search: false,
        document: false,
        agentic: false,
      });
    }
  }, [isThinkingFromWelcome, thinkingSession]);

  const getFilteredOptimisticMessage = useCallback((): Message | null => {
    if (!lastOptimisticMessage || !sessionId) {
      return null;
    }

    if (lastOptimisticMessage.session_id !== sessionId) {
      console.log(
        `⚠️ [usePredictiveSend] Filtering out optimistic message from different session: ${lastOptimisticMessage.session_id} (current: ${sessionId})`
      );
      return null;
    }

    if (sessionId !== currentSessionRef.current) {
      console.log(
        `⚠️ [usePredictiveSend] Filtering out optimistic message for inactive session: ${sessionId} (active: ${currentSessionRef.current})`
      );
      return null;
    }

    return lastOptimisticMessage;
  }, [lastOptimisticMessage, sessionId]);

  const findSimilarMessage = useCallback(
    (content: string, currentMessages: Message[]): Message | null => {
      return (
        currentMessages.find((msg) => {
          if (msg.role !== "user") return false;
          if (msg.content !== content) return false;

          const timeDiff = Math.abs(
            new Date().getTime() - new Date(msg.timestamp).getTime()
          );
          return timeDiff < 60000;
        }) || null
      );
    },
    []
  );

  const handleSend = useCallback(
    async (
      messageContentParam?: string | React.MouseEvent,
      messageAttachments?: Attachment[]
    ) => {
      let activeSessionId = sessionId;
      const currentMessages = messages || [];

      if (sessionId !== currentSessionId) {
        console.log("⚠️ usePredictiveSend: Ignoring send for old session");
        return;
      }

      // ✅ NUEVO: Limpiar cualquier error existente al iniciar un nuevo envío
      if (handleSendError && sessionId) {
        try {
          await fetch(`/api/hestia-states/clear-error`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
        } catch (error) {
          console.warn("⚠️ Could not clear previous error state:", error);
        }
      }

      let contentToSend = "";

      if (messageContentParam && typeof messageContentParam === "string") {
        contentToSend = messageContentParam;
      } else {
        contentToSend = input;
      }

      const trimmedContent = contentToSend.trim();
      const attachmentsToSend = messageAttachments || attachments || [];

      if (!trimmedContent && attachmentsToSend.length === 0) {
        console.warn("❌ No hay contenido para enviar");
        return;
      }

      const userMessageTimestamp = new Date().toISOString();
      console.log(
        "🕐 Timestamp del mensaje del usuario capturado:",
        userMessageTimestamp
      );

      setInput("");
      clearAttachments();

      try {
        setIsLoading(true);

        if (!activeSessionId) {
          activeSessionId = await onNewChat();
          if (!activeSessionId) {
            throw new Error("No se pudo crear una nueva sesión");
          }
        }

        const existingSimilarMessage = findSimilarMessage(
          trimmedContent,
          currentMessages
        );

        if (existingSimilarMessage) {
          console.log(
            "⚠️ [usePredictiveSend] Similar message already exists, skipping optimistic message creation:",
            existingSimilarMessage.id
          );
        } else {
          const nextVersion = calculateNextVersion(currentMessages);

          const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: trimmedContent,
            timestamp: userMessageTimestamp,
            attachments:
              attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
            project_id: projectId,
            session_id: activeSessionId,
            version_id: nextVersion,
            thinking: false,
            isOptimistic: true,
            isFirstMessage: !messages || messages.length === 0,
          };

          if (activeSessionId !== currentSessionRef.current) {
            console.log(
              "⚠️ usePredictiveSend: Session changed during message creation, aborting"
            );
            return;
          }

          console.log(
            "🚀 Mostrando mensaje optimista inmediatamente para sesión:",
            activeSessionId
          );
          setLastOptimisticMessage(userMessage);

          const updatedMessages = [...currentMessages, userMessage];
          updateMessages(updatedMessages);
        }

        console.log(
          "🚀 Guardando mensaje pendiente para sincronización cross-tab..."
        );

        const messageForPending = existingSimilarMessage || {
          id: crypto.randomUUID(),
          role: "user" as const,
          content: trimmedContent,
          timestamp: userMessageTimestamp,
          attachments:
            attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
          project_id: projectId,
          session_id: activeSessionId,
          version_id: calculateNextVersion(currentMessages),
          thinking: false,
          isOptimistic: true,
          isFirstMessage: !messages || messages.length === 0,
        };

        await setPending(activeSessionId, messageForPending);

        if (startLoadingWatch) {
          console.log(
            "🔄 Activando loading watch para sesión:",
            activeSessionId
          );
          startLoadingWatch();
        }

        if (aiButtonsState.reasoning) {
          setCurrentThinkingSession({
            sessionId: activeSessionId,
            versionId: calculateNextVersion(currentMessages),
          });
        }

        const isFirstMessageInChat = !messages || messages.length === 0;
        if (isFirstMessageInChat) {
          try {
            await fetch("/api/generate-title", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: trimmedContent,
                session_id: activeSessionId,
              }),
            });
          } catch (e) {
            console.error("Error llamando a generate-title:", e);
          }
        }

        const formData = new FormData();
        formData.append("message", trimmedContent);
        formData.append("sessionId", activeSessionId);
        formData.append("userMessageTimestamp", userMessageTimestamp);

        let buttonState = aiButtonsState;
        if (
          typeof window !== "undefined" &&
          (window as any).__aiButtonsStateFromWelcome
        ) {
          buttonState = (window as any).__aiButtonsStateFromWelcome;
          delete (window as any).__aiButtonsStateFromWelcome;
        }

        if (
          typeof window !== "undefined" &&
          (window as any).__currentButtonState
        ) {
          buttonState = (window as any).__currentButtonState;
          delete (window as any).__currentButtonState;
        }

        formData.append("thinking", buttonState.reasoning ? "true" : "false");
        formData.append("search", buttonState.search ? "true" : "false");
        formData.append("document", buttonState.document ? "true" : "false");
        formData.append("agentic", buttonState.agentic ? "true" : "false");

        if (attachmentsToSend.length > 0) {
          const validAttachments = attachmentsToSend.filter(
            (att) => att.fileKey && att.fileKey.trim() !== ""
          );

          if (validAttachments.length > 0) {
            const attachmentMetadatas = validAttachments.map((att) => ({
              name: att.name,
              type: att.type,
              size: att.file?.size || 0,
              fileKey: att.fileKey,
            }));

            const metadataString = JSON.stringify(attachmentMetadatas);
            formData.append("attachmentMetadata", metadataString);

            const fileKeysArray = validAttachments
              .map((att) => att.fileKey)
              .filter(Boolean) as string[];

            if (fileKeysArray.length > 0) {
              const fileKeysString = fileKeysArray.join(",");
              formData.append("fileKeys", fileKeysString);
              formData.append("fileKey", fileKeysArray[0]);
            }
          }
        }

        console.log("📤 Enviando mensaje a /api/predictive/analyze...");
        const response = await fetch("/api/predictive/analyze", {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error en la solicitud: ${errorText}`);
        }

        const analysis = await response.json();
        console.log("✅ Respuesta recibida de /api/predictive/analyze");

        console.log(
          "📝 Respuesta procesada, esperando actualización en tiempo real..."
        );

        if (activeSessionId === currentSessionRef.current) {
          setLastOptimisticMessage(null);
        }
      } catch (error) {
        console.error("❌ Error en handleSend:", error);

        // ✅ MEJORADO: Manejo completo de errores
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Error desconocido al enviar mensaje";

        // Detener el loading watch
        if (stopLoadingWatch) {
          stopLoadingWatch();
        }

        // ✅ NUEVO: Actualizar estado de error en la base de datos
        if (handleSendError && sessionId) {
          try {
            if (!activeSessionId) {
              throw new Error("No session ID available for failed message");
            }

            // Crear el mensaje que falló para poder reintentarlo
            const failedMessage: Message = {
              id: crypto.randomUUID(),
              role: "user",
              content: trimmedContent,
              timestamp: userMessageTimestamp,
              attachments:
                attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
              project_id: projectId,
              session_id: activeSessionId,
              version_id: calculateNextVersion(currentMessages),
              thinking: false,
              isOptimistic: false,
              isFirstMessage: !messages || messages.length === 0,
            };

            await handleSendError(sessionId, errorMessage, failedMessage);
            console.log("✅ Error state updated in database");
          } catch (dbError) {
            console.error(
              "❌ Failed to update error state in database:",
              dbError
            );
          }
        }

        // Actualizar mensaje optimista con error
        const currentOptimisticMessage = getFilteredOptimisticMessage();
        if (currentOptimisticMessage && messages) {
          updateMessages(
            messages.map((msg) => {
              if (msg.isOptimistic && msg.id === currentOptimisticMessage.id) {
                return {
                  ...msg,
                  error: true,
                  errorMessage: errorMessage,
                  isOptimistic: false,
                };
              }
              return msg;
            })
          );
        }
      } finally {
        if (sessionId === currentSessionId) {
          setIsLoading(false);
        }
      }
    },
    [
      input,
      messages,
      sessionId,
      currentSessionId,
      projectId,
      attachments,
      updateMessages,
      clearAttachments,
      onNewChat,
      calculateNextVersion,
      aiButtonsState,
      startLoadingWatch,
      stopLoadingWatch,
      handleSendError, // ✅ NUEVO
      setPending,
      clearPending,
      getFilteredOptimisticMessage,
      findSimilarMessage,
    ]
  );

  const handleButtonStateChange = useCallback(
    (newState: AIButtonsState) => {
      setAiButtonsState(newState);
    },
    [aiButtonsState]
  );

  return {
    input,
    setInput,
    isLoading,
    aiButtonsState,
    handleButtonStateChange,
    handleSend,
    lastOptimisticMessage: getFilteredOptimisticMessage(),
    thinkingContent,
    isThinking,
    isThinkingComplete,
    finishThinking,
    isReasoningActive: aiButtonsState.reasoning || isThinkingFromWelcome,
    savedThinkingContent,
  };
}
