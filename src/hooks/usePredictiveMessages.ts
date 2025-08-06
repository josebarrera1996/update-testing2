"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Message } from "@/components/predictive/PredictiveTypes";
import type {
  UsePredictiveMessagesParams,
  UsePredictiveMessagesReturn,
} from "./PredictiveHookTypes";
import { useLoadingState } from "./useLoadingState";
import { createClient } from "@/lib/supabase-client";

export function usePredictiveMessages({
  initialMessages,
  sessionId,
  onUpdateMessages,
}: UsePredictiveMessagesParams): UsePredictiveMessagesReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);

  const scrollPositionRef = useRef<{
    scrollTop: number;
    scrollHeight: number;
  } | null>(null);
  const MESSAGES_PER_PAGE = 10;
  const currentSessionRef = useRef<string | null>(null);
  const supabase = createClient();
  const messageChannelRef = useRef<any>(null);
  const isUpdatingFromRealtimeRef = useRef(false);
  const lastMessageCountRef = useRef<number>(0);
  // ✅ NUEVO: Referencia para rastrear la sesión de la suscripción activa
  const activeMessageSubscriptionSessionRef = useRef<string | null>(null);

  // ✅ MANEJAR RESPUESTA RECIBIDA
  const handleResponseReceived = useCallback(
    (responseData: any) => {
      console.log(
        `📨 [usePredictiveMessages] Processing received response for session: ${sessionId}`
      );
      console.log(
        `📨 [usePredictiveMessages] Response processed, waiting for real-time update...`
      );
    },
    [sessionId]
  );

  // ✅ USAR LOADING STATE UNIFICADO CON VALIDACIÓN DE SESIÓN MEJORADA
  const {
    isLoading,
    pendingMessage: rawPendingMessage,
    startWatching,
    stopWatching,
    startLoading,
  } = useLoadingState({
    sessionId,
    onResponseReceived: handleResponseReceived,
    // ✅ SOLUCIÓN: Añadir validación estricta de sesión
    sessionValidator: (loadingSessionId) => {
      const isValid =
        loadingSessionId === sessionId &&
        loadingSessionId === currentSessionRef.current;
      if (!isValid) {
        console.log(
          `⚠️ [usePredictiveMessages] Session validator rejected: ${loadingSessionId} (current: ${sessionId}, ref: ${currentSessionRef.current})`
        );
      }
      return isValid;
    },
  });

  // ✅ SOLUCIÓN PRINCIPAL: Filtrar pendingMessage por session_id
  const pendingMessage = useCallback(() => {
    if (!rawPendingMessage || !sessionId) {
      return null;
    }

    // ✅ VERIFICAR QUE EL PENDING MESSAGE PERTENEZCA A LA SESIÓN ACTUAL
    if (
      rawPendingMessage.session_id &&
      rawPendingMessage.session_id !== sessionId
    ) {
      console.log(
        `⚠️ [usePredictiveMessages] Filtering out pending message from different session: ${rawPendingMessage.session_id} (current: ${sessionId})`
      );
      return null;
    }

    // ✅ VERIFICAR QUE LA SESIÓN ACTUAL SEA LA REFERENCIA ACTIVA
    if (sessionId !== currentSessionRef.current) {
      console.log(
        `⚠️ [usePredictiveMessages] Filtering out pending message for inactive session: ${sessionId} (active: ${currentSessionRef.current})`
      );
      return null;
    }

    console.log(
      `✅ [usePredictiveMessages] Pending message validated for session: ${sessionId}`
    );
    return rawPendingMessage;
  }, [rawPendingMessage, sessionId]);

  // ✅ FUNCIÓN PARA CARGAR MENSAJES DESDE LA BASE DE DATOS
  const loadMessagesFromDB = useCallback(async () => {
    if (!sessionId) return;

    try {
      console.log(
        `🔄 [usePredictiveMessages] Loading messages from DB for session: ${sessionId}`
      );
      const { data, error } = await supabase
        .from("hestia_chats")
        .select("messages")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (error) {
        console.error("Error loading messages from DB:", error);
        return;
      }

      const dbMessages = data?.messages || [];

      // ✅ PRESERVAR MENSAJES OPTIMISTAS DE PROPS INICIALES
      const optimisticMessages = initialMessages.filter(
        (msg) => msg.isOptimistic
      );

      console.log(
        `✅ [usePredictiveMessages] Loaded ${dbMessages.length} messages from DB, preserving ${optimisticMessages.length} optimistic messages for session: ${sessionId}`
      );

      isUpdatingFromRealtimeRef.current = true;

      // ✅ COMBINAR MENSAJES DE DB CON OPTIMISTAS, EVITANDO DUPLICADOS
      const combinedMessages = [...dbMessages];

      optimisticMessages.forEach((optimisticMsg) => {
        const exists = dbMessages.some(
          (dbMsg: any) =>
            dbMsg.role === optimisticMsg.role &&
            dbMsg.content === optimisticMsg.content &&
            Math.abs(
              new Date(dbMsg.timestamp).getTime() -
                new Date(optimisticMsg.timestamp).getTime()
            ) < 60000
        );

        if (!exists) {
          console.log(
            `✅ [usePredictiveMessages] Preserving optimistic message: ${optimisticMsg.id}`
          );
          combinedMessages.push(optimisticMsg);
        }
      });

      // ✅ ORDENAR POR TIMESTAMP
      combinedMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setMessages(combinedMessages);
      lastMessageCountRef.current = combinedMessages.length;

      setTimeout(() => {
        isUpdatingFromRealtimeRef.current = false;
      }, 100);
    } catch (error) {
      console.error("Error in loadMessagesFromDB:", error);
    }
  }, [sessionId, supabase, initialMessages]);

  // ✅ FUNCIÓN MEJORADA: Cleanup más agresivo para suscripciones de mensajes
  const cleanupMessageSubscription = useCallback(() => {
    if (messageChannelRef.current) {
      console.log(
        `🧹 [usePredictiveMessages] Cleaning up message subscription for session: ${activeMessageSubscriptionSessionRef.current}`
      );
      try {
        supabase.removeChannel(messageChannelRef.current);
      } catch (error) {
        console.error("Error removing message channel:", error);
      }
      messageChannelRef.current = null;
      activeMessageSubscriptionSessionRef.current = null;
    }
  }, [supabase]);

  // ✅ SUSCRIPCIÓN A CAMBIOS EN HESTIA_CHATS CON MEJOR AISLAMIENTO
  const setupMessageSubscription = useCallback(() => {
    if (!sessionId || messageChannelRef.current) return;

    // ✅ VERIFICAR QUE SEA LA SESIÓN ACTUAL
    if (sessionId !== currentSessionRef.current) {
      console.log(
        `⚠️ [usePredictiveMessages] Skipping subscription for old session: ${sessionId} (current: ${currentSessionRef.current})`
      );
      return;
    }

    console.log(
      `📡 [usePredictiveMessages] Setting up message subscription for session: ${sessionId}`
    );

    // ✅ CLEANUP PREVENTIVO
    cleanupMessageSubscription();

    let debounceTimeout: NodeJS.Timeout | null = null;

    // ✅ CREAR CANAL CON IDENTIFICADOR ÚNICO
    const channelName = `hestia-chats-${sessionId}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hestia_chats",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          // ✅ VERIFICAR QUE LA ACTUALIZACIÓN SEA PARA LA SESIÓN ACTUAL
          if (payload.new?.session_id !== currentSessionRef.current) {
            console.log(
              `⚠️ [usePredictiveMessages] Ignoring message UPDATE for old session: ${payload.new?.session_id} (current: ${currentSessionRef.current})`
            );
            return;
          }

          const newMessageCount = payload.new?.messages?.length || 0;
          console.log(
            `📡 [usePredictiveMessages] Real-time message UPDATE received for session ${payload.new?.session_id}:`,
            {
              messageCount: newMessageCount,
              previousCount: lastMessageCountRef.current,
            }
          );

          // ✅ SOLO ACTUALIZAR SI HAY CAMBIOS REALES Y ES LA SESIÓN ACTUAL
          if (payload.new?.session_id === currentSessionRef.current) {
            // ✅ LÓGICA INTELIGENTE: No sobrescribir mensajes optimistas con DB vacía
            const newDbMessages = payload.new?.messages || [];
            const currentMessages = messages || [];
            const hasOptimisticMessages = currentMessages.some(
              (msg) => msg.isOptimistic
            );
            const hasLoadingState = isLoading; // Usar el isLoading del hook

            console.log(
              `🔍 [usePredictiveMessages] Real-time update analysis:`,
              {
                newDbCount: newDbMessages.length,
                currentLocalCount: currentMessages.length,
                hasOptimistic: hasOptimisticMessages,
                isLoading: hasLoadingState,
                shouldUpdate:
                  newDbMessages.length > 0 ||
                  (!hasOptimisticMessages && !hasLoadingState),
              }
            );

            // ✅ CONDICIONES PARA ACTUALIZAR:
            // 1. DB tiene mensajes nuevos (> 0)
            // 2. O no hay mensajes optimistas locales Y no hay loading activo
            const shouldUpdate =
              newDbMessages.length > 0 ||
              (!hasOptimisticMessages && !hasLoadingState);

            if (
              shouldUpdate &&
              newMessageCount !== lastMessageCountRef.current
            ) {
              // ✅ DEBOUNCE para evitar actualizaciones múltiples
              if (debounceTimeout) {
                clearTimeout(debounceTimeout);
              }

              debounceTimeout = setTimeout(() => {
                if (
                  payload.new?.messages &&
                  payload.new.session_id === currentSessionRef.current
                ) {
                  console.log(
                    `🔄 [usePredictiveMessages] Updating messages from real-time subscription for session: ${payload.new.session_id}`
                  );
                  isUpdatingFromRealtimeRef.current = true;
                  setMessages(payload.new.messages);
                  lastMessageCountRef.current = payload.new.messages.length;
                  setTimeout(() => {
                    isUpdatingFromRealtimeRef.current = false;
                  }, 100);
                }
              }, 150);
            } else {
              console.log(
                `⚠️ [usePredictiveMessages] Skipping real-time update to preserve optimistic messages or loading state`
              );
            }
          } else {
            console.log(
              `⚠️ [usePredictiveMessages] Same message count or wrong session, skipping update`
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.log(
          `📡 [usePredictiveMessages] Message subscription status for ${channelName}:`,
          status
        );

        if (err) {
          console.log(
            `❌ [usePredictiveMessages] Message subscription error for ${channelName}:`,
            err
          );
        }

        if (status === "SUBSCRIBED") {
          // ✅ VERIFICAR QUE TODAVÍA SEA LA SESIÓN ACTUAL
          if (sessionId === currentSessionRef.current) {
            messageChannelRef.current = channel;
            activeMessageSubscriptionSessionRef.current = sessionId;
            console.log(
              `✅ [usePredictiveMessages] Successfully subscribed to message updates for session: ${sessionId}`
            );
          } else {
            console.log(
              `⚠️ [usePredictiveMessages] Session changed during message subscription, cleaning up: ${sessionId} → ${currentSessionRef.current}`
            );
            try {
              supabase.removeChannel(channel);
            } catch (error) {
              console.error(
                "Error removing message channel during session change:",
                error
              );
            }
          }
        } else if (status === "CHANNEL_ERROR") {
          console.log(
            `❌ [usePredictiveMessages] Message channel error for session: ${sessionId}`
          );
          if (messageChannelRef.current === channel) {
            messageChannelRef.current = null;
            activeMessageSubscriptionSessionRef.current = null;
          }
        } else if (status === "CLOSED") {
          console.log(
            `📡 [usePredictiveMessages] Message subscription closed for session: ${sessionId}`
          );
          if (messageChannelRef.current === channel) {
            messageChannelRef.current = null;
            activeMessageSubscriptionSessionRef.current = null;
          }
        }
      });

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [sessionId, supabase, cleanupMessageSubscription, isLoading]); // ✅ Agregar isLoading

  // ✅ RESET INMEDIATO Y AGRESIVO cuando cambia sessionId
  useEffect(() => {
    if (sessionId !== currentSessionRef.current) {
      console.log(
        `🔄 [usePredictiveMessages] Messages reset for new session: ${sessionId}`
      );
      currentSessionRef.current = sessionId;

      // ✅ LIMPIAR SUSCRIPCIÓN ANTERIOR INMEDIATAMENTE
      cleanupMessageSubscription();

      // ✅ PRESERVAR MENSAJES OPTIMISTAS DE INITIAL MESSAGES
      const optimisticMessages = (initialMessages || []).filter(
        (msg) => msg.isOptimistic
      );
      const hasOptimisticMessages = optimisticMessages.length > 0;

      if (hasOptimisticMessages) {
        console.log(
          `✅ [usePredictiveMessages] Preserving ${optimisticMessages.length} optimistic messages during session change`
        );
        setMessages(optimisticMessages);
        lastMessageCountRef.current = optimisticMessages.length;
      } else {
        // ✅ RESET NORMAL SI NO HAY MENSAJES OPTIMISTAS
        setMessages(initialMessages || []);
        lastMessageCountRef.current = 0;
      }

      setVisibleMessages([]);
      setPage(0);
      setHasMoreMessages(true);
      setAllMessagesLoaded(false);
      scrollPositionRef.current = null;

      // ✅ CARGAR MENSAJES Y CONFIGURAR SUSCRIPCIÓN SOLO PARA LA SESIÓN ACTUAL
      if (sessionId) {
        loadMessagesFromDB();
        setupMessageSubscription();
      }
    }
  }, [
    sessionId,
    initialMessages,
    cleanupMessageSubscription,
    loadMessagesFromDB,
    setupMessageSubscription,
  ]);

  // ✅ PROCESAR MENSAJES CON PENDING - MEJORADO CON FILTRADO POR SESIÓN
  const processMessages = useCallback(
    (baseMessages: Message[]): Message[] => {
      const result = [...baseMessages];
      const currentPendingMessage = pendingMessage();

      // ✅ AGREGAR PENDING MESSAGE SOLO SI PERTENECE A LA SESIÓN ACTUAL Y NO EXISTE YA
      if (currentPendingMessage && sessionId) {
        // ✅ VERIFICACIÓN ADICIONAL: El pending message debe ser para esta sesión
        if (
          currentPendingMessage.session_id &&
          currentPendingMessage.session_id !== sessionId
        ) {
          console.log(
            `⚠️ [usePredictiveMessages] Skipping pending message from different session: ${currentPendingMessage.session_id} (current: ${sessionId})`
          );
          return result.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }

        const exists = result.some((msg) => {
          if (
            msg.role !== "user" ||
            msg.content !== currentPendingMessage.content
          ) {
            return false;
          }

          const timeDiff = Math.abs(
            new Date(msg.timestamp).getTime() -
              new Date(currentPendingMessage.timestamp).getTime()
          );
          return timeDiff < 60000;
        });

        if (!exists) {
          console.log(
            `➕ [usePredictiveMessages] Adding pending message to display for session: ${sessionId}`
          );
          result.push(currentPendingMessage);
        } else {
          console.log(
            `⚠️ [usePredictiveMessages] Pending message already exists in real messages, skipping for session: ${sessionId}`
          );
        }
      }

      return result.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    },
    [pendingMessage, sessionId]
  );

  // Cargar mensajes iniciales
  useEffect(() => {
    const processedMessages = processMessages(messages);

    if (processedMessages.length > 0) {
      const totalMessages = processedMessages.length;
      const initialMessagesToShow = Math.min(MESSAGES_PER_PAGE, totalMessages);
      const startIndex = Math.max(0, totalMessages - initialMessagesToShow);
      const initialMessages = processedMessages.slice(startIndex);

      setVisibleMessages(initialMessages);
      setHasMoreMessages(totalMessages > initialMessagesToShow);
      setAllMessagesLoaded(totalMessages <= initialMessagesToShow);
      setPage(1);
    } else {
      setVisibleMessages([]);
      setHasMoreMessages(false);
      setAllMessagesLoaded(true);
      setPage(0);
    }
  }, [messages, processMessages]);

  const loadMoreMessages = useCallback(
    (scrollContainer?: HTMLElement | null) => {
      if (!hasMoreMessages || isLoadingMore) {
        return;
      }

      setIsLoadingMore(true);

      if (scrollContainer) {
        const { scrollTop, scrollHeight } = scrollContainer;
        scrollPositionRef.current = { scrollTop, scrollHeight };
      }

      const allMessages = processMessages(messages);
      const totalMessages = allMessages.length;
      const currentlyLoaded = visibleMessages.length;

      const messagesToLoad = Math.min(
        MESSAGES_PER_PAGE,
        totalMessages - currentlyLoaded
      );

      if (messagesToLoad <= 0) {
        setHasMoreMessages(false);
        setAllMessagesLoaded(true);
        setIsLoadingMore(false);
        return;
      }

      const endIndex = totalMessages - currentlyLoaded;
      const startIndex = Math.max(0, endIndex - messagesToLoad);
      const newMessages = allMessages.slice(startIndex, endIndex);

      const visibleMessageIds = new Set(visibleMessages.map((m) => m.id));
      const filteredNewMessages = newMessages.filter(
        (m) => !visibleMessageIds.has(m.id)
      );

      if (filteredNewMessages.length > 0) {
        setVisibleMessages((prevMessages) => [
          ...filteredNewMessages,
          ...prevMessages,
        ]);
        setPage((prev) => prev + 1);
      }

      const stillHasMore = startIndex > 0;
      setHasMoreMessages(stillHasMore);
      setAllMessagesLoaded(!stillHasMore);

      setTimeout(() => {
        setIsLoadingMore(false);
      }, 100);
    },
    [messages, visibleMessages, hasMoreMessages, isLoadingMore, processMessages]
  );

  const restoreScrollPosition = useCallback(
    (scrollContainer: HTMLElement | null) => {
      if (!scrollContainer || !scrollPositionRef.current || isLoadingMore)
        return;

      requestAnimationFrame(() => {
        if (scrollContainer && scrollPositionRef.current) {
          const {
            scrollTop: originalScrollTop,
            scrollHeight: originalScrollHeight,
          } = scrollPositionRef.current;
          const newScrollHeight = scrollContainer.scrollHeight;
          const heightDifference = newScrollHeight - originalScrollHeight;
          const newScrollTop = originalScrollTop + heightDifference;

          scrollContainer.scrollTop = newScrollTop;
          scrollPositionRef.current = null;
        }
      });
    },
    [isLoadingMore]
  );

  const calculateCorrectVersionId = useCallback(
    (message: Message): number => {
      if (message.role !== "assistant") return -1;

      const allMessages = processMessages(messages);
      const validPairs: { user: Message; assistant: Message }[] = [];

      for (let i = 0; i < allMessages.length - 1; i++) {
        if (
          allMessages[i].role === "user" &&
          !allMessages[i].error &&
          i + 1 < allMessages.length &&
          allMessages[i + 1].role === "assistant"
        ) {
          validPairs.push({
            user: allMessages[i],
            assistant: allMessages[i + 1],
          });
        }
      }

      const pairIndex = validPairs.findIndex(
        (pair) => pair.assistant.id === message.id
      );
      return pairIndex;
    },
    [messages, processMessages]
  );

  const calculateNextVersion = useCallback((messages: Message[]): number => {
    if (!messages || messages.length === 0) return 0;
    const validPairs = [];
    let i = 0;
    while (i < messages.length) {
      const userMessage = messages[i];
      if (
        userMessage.role === "user" &&
        !userMessage.error &&
        i + 1 < messages.length &&
        messages[i + 1].role === "assistant"
      ) {
        validPairs.push({ userMessage, assistantMessage: messages[i + 1] });
        i += 2;
      } else {
        i++;
      }
    }
    return validPairs.length;
  }, []);

  // ✅ MEJORAR updateMessages para evitar conflictos con real-time
  const updateMessages = useCallback(
    (newMessages: Message[]) => {
      if (isUpdatingFromRealtimeRef.current) {
        console.log(
          `⚠️ [usePredictiveMessages] Skipping updateMessages - real-time update in progress for session: ${sessionId}`
        );
        return;
      }

      console.log(
        `🔄 [usePredictiveMessages] updateMessages called with ${newMessages.length} messages for session: ${sessionId}`
      );
      setMessages(newMessages);

      if (onUpdateMessages && sessionId) {
        const nonOptimisticMessages = newMessages.filter(
          (msg) => !msg.isOptimistic
        );
        const previousNonOptimistic = messages.filter(
          (msg) => !msg.isOptimistic
        );
        const hasNewRealMessages =
          nonOptimisticMessages.length > previousNonOptimistic.length;

        if (hasNewRealMessages) {
          onUpdateMessages(sessionId, nonOptimisticMessages);
        }
      }
    },
    [sessionId, onUpdateMessages, messages]
  );

  // ✅ CLEANUP AGRESIVO al desmontar
  useEffect(() => {
    return () => {
      console.log(
        `🧹 [usePredictiveMessages] Component unmounting, cleaning up for session: ${sessionId}`
      );
      cleanupMessageSubscription();
    };
  }, [cleanupMessageSubscription, sessionId]);

  return {
    messages: processMessages(messages),
    visibleMessages,
    hasMoreMessages,
    isLoadingMore,
    allMessagesLoaded,
    loadMoreMessages,
    restoreScrollPosition,
    calculateCorrectVersionId,
    calculateNextVersion,
    updateMessages,
    setMessages,
    isLoading,
    pendingMessage: pendingMessage(), // ✅ Usar la función filtrada
    startLoading,
    stopLoading: stopWatching,
    loadMessagesFromDB,
  };
}

export default usePredictiveMessages;
