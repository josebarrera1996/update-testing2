"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-client";
import type { Message } from "@/components/predictive/PredictiveTypes";

interface UseLoadingStateProps {
  sessionId: string | null;
  onResponseReceived?: (responseData: any) => void;
  sessionValidator?: (sessionId: string) => boolean;
}

interface LoadingState {
  isLoading: boolean;
  pendingMessage: Message | null;
  pendingResponse: any | null;
  hasError: boolean;
  errorMessage?: string;
  failedMessage?: Message | null; // ✅ Mensaje que falló para poder reintentarlo
}

export function useLoadingState({
  sessionId,
  onResponseReceived,
  sessionValidator,
}: UseLoadingStateProps) {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    pendingMessage: null,
    pendingResponse: null,
    hasError: false,
    errorMessage: undefined,
    failedMessage: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const supabase = createClient();
  const channelRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedResponsesRef = useRef<Set<string>>(new Set());
  const currentSessionRef = useRef<string | null>(null);
  const initialLoadRef = useRef<boolean>(false);
  const isCheckingRef = useRef<boolean>(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSendError = useCallback(
    async (
      sessionId: string,
      errorMessage: string,
      failedMessage?: Message
    ) => {
      console.log(
        "🚨 Handling send error for session:",
        sessionId,
        "Error:",
        errorMessage
      );

      try {
        // Actualizar estado en la base de datos
        const { error: updateError } = await supabase
          .from("hestia_states")
          .upsert(
            {
              session_id: sessionId,
              is_loading: false,
              has_error: true,
              error_message: errorMessage,
              failed_message: failedMessage, // ✅ Guardar en la base de datos
              pending_messages: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id" }
          );

        if (updateError) {
          console.error(
            "❌ Error updating error state in database:",
            updateError
          );
        } else {
          console.log("✅ Error state updated in database");
        }

        // Actualizar estado local solo si es la sesión actual
        if (sessionId === currentSessionRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            hasError: true,
            errorMessage: errorMessage,
            failedMessage: failedMessage || null,
            pendingMessage: null,
          }));
        }
      } catch (err) {
        console.error("❌ Error in handleSendError:", err);
      }
    },
    [supabase]
  );

  const clearError = useCallback(
    async (sessionId: string) => {
      console.log("🧹 Clearing error state for session:", sessionId);

      try {
        const { error: updateError } = await supabase
          .from("hestia_states")
          .upsert(
            {
              session_id: sessionId,
              has_error: false,
              error_message: null,
              failed_message: null, // ✅ Limpiar en la base de datos
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id" }
          );

        if (updateError) {
          console.error("❌ Error clearing error state:", updateError);
        }

        // Actualizar estado local
        if (sessionId === currentSessionRef.current) {
          setState((prev) => ({
            ...prev,
            hasError: false,
            errorMessage: undefined,
            failedMessage: null, // ✅ Limpiar en el estado local
          }));
        }
      } catch (err) {
        console.error("❌ Error in clearError:", err);
      }
    },
    [supabase]
  );

  // Reset mejorado con limpieza de errores
  useEffect(() => {
    if (sessionId !== currentSessionRef.current) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      setState({
        isLoading: false,
        pendingMessage: null,
        pendingResponse: null,
        hasError: false,
        errorMessage: undefined,
        failedMessage: null,
      });

      currentSessionRef.current = sessionId;
      initialLoadRef.current = false;
      isCheckingRef.current = false;

      cleanup();
      processedResponsesRef.current.clear();
      setError(null);

      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            pendingMessage: null,
            pendingResponse: null,
            hasError: false,
            errorMessage: undefined,
            failedMessage: null,
          }));

          requestAnimationFrame(() => {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              pendingMessage: null,
              pendingResponse: null,
              hasError: false,
              errorMessage: undefined,
              failedMessage: null,
            }));
          });
        });
      }
    }
  }, [sessionId]);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsSubscribed(false);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    isCheckingRef.current = false;
  }, [supabase]);

  const processResponse = useCallback(
    async (responseData: any) => {
      if (
        !sessionId ||
        !responseData ||
        sessionId !== currentSessionRef.current
      )
        return;

      const responseId = `${sessionId}-${JSON.stringify(responseData).substring(
        0,
        100
      )}`;

      if (processedResponsesRef.current.has(responseId)) {
        return;
      }

      processedResponsesRef.current.add(responseId);

      if (onResponseReceived) {
        onResponseReceived(responseData);
      }

      try {
        await fetch(`/api/hestia-states/response`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        await fetch(`/api/hestia-states/pending`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (error) {
        console.error("Error clearing pending states:", error);
      }

      if (sessionId === currentSessionRef.current) {
        setState({
          isLoading: false,
          pendingMessage: null,
          pendingResponse: null,
          hasError: false,
          errorMessage: undefined,
          failedMessage: null, // ✅ Limpiar al recibir respuesta exitosa
        });
        cleanup();
      }
    },
    [sessionId, onResponseReceived, cleanup]
  );

  const shouldBeLoading = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (isCheckingRef.current) {
        return false;
      }

      if (sessionId !== currentSessionRef.current) {
        return false;
      }

      if (sessionValidator && !sessionValidator(sessionId)) {
        return false;
      }

      isCheckingRef.current = true;

      try {
        const [statesResult, chatsResult] = await Promise.all([
          supabase
            .from("hestia_states")
            .select(
              "is_loading, pending_messages, pending_response, has_error, error_message, failed_message"
            ) // ✅ Incluir failed_message
            .eq("session_id", sessionId)
            .maybeSingle(),
          supabase
            .from("hestia_chats")
            .select("messages")
            .eq("session_id", sessionId)
            .maybeSingle(),
        ]);

        if (sessionId !== currentSessionRef.current) {
          return false;
        }

        const statesData = statesResult.data;
        const chatsData = chatsResult.data;

        // ✅ Si hay error, no debería estar loading
        if (statesData?.has_error) {
          console.log("🚨 Found error state, should not be loading");
          return false;
        }

        if (statesData?.pending_response) {
          await processResponse(statesData.pending_response);
          return false;
        }

        if (!statesData?.is_loading) {
          return false;
        }

        if (statesData.is_loading && !statesData.pending_messages) {
          await fetch(`/api/hestia-states/pending`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
          return false;
        }

        if (statesData.pending_messages && chatsData?.messages) {
          const pendingContent = statesData.pending_messages.content;
          const messageExists = chatsData.messages.some(
            (msg: any) => msg.role === "user" && msg.content === pendingContent
          );

          if (messageExists) {
            await fetch(`/api/hestia-states/pending`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: sessionId }),
            });
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error("Error verifying loading state:", error);
        return false;
      } finally {
        isCheckingRef.current = false;
      }
    },
    [supabase, sessionValidator, processResponse]
  );

  const checkCurrentState = useCallback(async (): Promise<LoadingState> => {
    if (!sessionId || sessionId !== currentSessionRef.current) {
      return {
        isLoading: false,
        pendingMessage: null,
        pendingResponse: null,
        hasError: false,
        errorMessage: undefined,
        failedMessage: null,
      };
    }

    if (isCheckingRef.current) {
      return state;
    }

    try {
      const shouldLoad = await shouldBeLoading(sessionId);

      if (sessionId !== currentSessionRef.current) {
        return {
          isLoading: false,
          pendingMessage: null,
          pendingResponse: null,
          hasError: false,
          errorMessage: undefined,
          failedMessage: null,
        };
      }

      if (!shouldLoad) {
        return {
          isLoading: false,
          pendingMessage: null,
          pendingResponse: null,
          hasError: false,
          errorMessage: undefined,
          failedMessage: null,
        };
      }

      const { data, error } = await supabase
        .from("hestia_states")
        .select(
          "is_loading, pending_messages, pending_response, has_error, error_message, failed_message"
        ) // ✅ Incluir failed_message
        .eq("session_id", sessionId)
        .maybeSingle();

      if (error) {
        console.error("Error checking current state:", error);
        return {
          isLoading: false,
          pendingMessage: null,
          pendingResponse: null,
          hasError: false,
          errorMessage: undefined,
          failedMessage: null,
        };
      }

      if (sessionId !== currentSessionRef.current) {
        return {
          isLoading: false,
          pendingMessage: null,
          pendingResponse: null,
          hasError: false,
          errorMessage: undefined,
          failedMessage: null,
        };
      }

      return {
        isLoading: data?.is_loading || false,
        pendingMessage: data?.pending_messages
          ? { ...data.pending_messages, isOptimistic: true }
          : null,
        pendingResponse: data?.pending_response || null,
        hasError: data?.has_error || false,
        errorMessage: data?.error_message || undefined,
        failedMessage: data?.failed_message || null, // ✅ Leer de la base de datos
      };
    } catch (err) {
      console.error("Error in checkCurrentState:", err);
      return {
        isLoading: false,
        pendingMessage: null,
        pendingResponse: null,
        hasError: false,
        errorMessage: undefined,
        failedMessage: null,
      };
    }
  }, [sessionId, supabase, shouldBeLoading, state]);

  const startLoading = useCallback(
    async (pendingMessage: Message) => {
      if (!sessionId || sessionId !== currentSessionRef.current) return;

      try {
        const response = await fetch(`/api/hestia-states/pending`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            pending_message: pendingMessage,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to save pending message: ${response.statusText}`
          );
        }

        if (sessionId === currentSessionRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: true,
            pendingMessage: { ...pendingMessage, isOptimistic: true },
            hasError: false,
            errorMessage: undefined,
            failedMessage: null,
          }));
        }
      } catch (error) {
        console.error("❌ Error starting loading state:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
      }
    },
    [sessionId]
  );

  const startWatching = useCallback(async () => {
    if (!sessionId || isSubscribed || sessionId !== currentSessionRef.current)
      return;

    if (sessionValidator && !sessionValidator(sessionId)) {
      return;
    }

    const initialState = await checkCurrentState();

    if (sessionId !== currentSessionRef.current) {
      return;
    }

    setState(initialState);
    initialLoadRef.current = true;

    if (initialState.pendingResponse) {
      await processResponse(initialState.pendingResponse);
      return;
    }

    if (!initialState.isLoading) {
      return;
    }

    const channel = supabase
      .channel(`hestia-state-${sessionId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hestia_states",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          if (payload.new?.session_id !== currentSessionRef.current) {
            return;
          }

          if (
            payload.new &&
            payload.new.session_id === currentSessionRef.current
          ) {
            const newState: LoadingState = {
              isLoading: payload.new.is_loading || false,
              pendingMessage: payload.new.pending_messages
                ? { ...payload.new.pending_messages, isOptimistic: true }
                : null,
              pendingResponse: payload.new.pending_response || null,
              hasError: payload.new.has_error || false,
              errorMessage: payload.new.error_message || undefined,
              failedMessage: payload.new.failed_message || null, // ✅ Leer de la base de datos
            };

            setState(newState);

            if (newState.pendingResponse) {
              await processResponse(newState.pendingResponse);
            } else if (!newState.isLoading && !newState.pendingMessage) {
              cleanup();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hestia_states",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          if (payload.new?.session_id !== currentSessionRef.current) {
            return;
          }

          if (
            payload.new &&
            payload.new.session_id === currentSessionRef.current
          ) {
            const newState: LoadingState = {
              isLoading: payload.new.is_loading || false,
              pendingMessage: payload.new.pending_messages
                ? { ...payload.new.pending_messages, isOptimistic: true }
                : null,
              pendingResponse: payload.new.pending_response || null,
              hasError: payload.new.has_error || false,
              errorMessage: payload.new.error_message || undefined,
              failedMessage: payload.new.failed_message || null, // ✅ Leer de la base de datos
            };

            setState(newState);

            if (newState.pendingResponse) {
              await processResponse(newState.pendingResponse);
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.log("❌ Loading subscription error:", err);
        }

        if (status === "SUBSCRIBED") {
          if (sessionId === currentSessionRef.current) {
            setIsSubscribed(true);
            channelRef.current = channel;

            timeoutRef.current = setTimeout(() => {
              cleanup();
              if (sessionId === currentSessionRef.current) {
                setState((prev) => ({ ...prev, isLoading: false }));
              }
            }, 2 * 60 * 1000);
          } else {
            try {
              supabase.removeChannel(channel);
            } catch (error) {
              console.error(
                "Error removing channel during session change:",
                error
              );
            }
          }
        } else if (status === "CHANNEL_ERROR") {
          if (channelRef.current === channel) {
            channelRef.current = null;
            setIsSubscribed(false);
          }
        } else if (status === "CLOSED") {
          setIsSubscribed(false);
        }
      });
  }, [
    sessionId,
    isSubscribed,
    supabase,
    checkCurrentState,
    processResponse,
    cleanup,
    sessionValidator,
  ]);

  const stopWatching = useCallback(() => {
    cleanup();
    if (sessionId === currentSessionRef.current) {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [cleanup, sessionId]);

  useEffect(() => {
    if (
      sessionId &&
      sessionId === currentSessionRef.current &&
      !initialLoadRef.current
    ) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        if (
          sessionId === currentSessionRef.current &&
          !initialLoadRef.current
        ) {
          checkCurrentState().then((initialState) => {
            if (sessionId === currentSessionRef.current) {
              setState(initialState);
              initialLoadRef.current = true;

              if (initialState.isLoading && !isSubscribed) {
                setTimeout(() => {
                  if (sessionId === currentSessionRef.current) {
                    startWatching();
                  }
                }, 100);
              }
            }
          });
        }
      }, 50);
    }
  }, [sessionId, checkCurrentState, isSubscribed, startWatching]);

  useEffect(() => {
    if (
      state.isLoading &&
      !isSubscribed &&
      sessionId &&
      sessionId === currentSessionRef.current &&
      initialLoadRef.current
    ) {
      startWatching();
    }
  }, [state.isLoading, isSubscribed, sessionId, startWatching]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isLoading: state.isLoading,
    pendingMessage: state.pendingMessage,
    pendingResponse: state.pendingResponse,
    hasError: state.hasError,
    errorMessage: state.errorMessage,
    failedMessage: state.failedMessage, // ✅ Exponer failedMessage
    error,
    isSubscribed,
    startWatching,
    stopWatching,
    startLoading,
    checkCurrentState,
    handleSendError,
    clearError,
  };
}
