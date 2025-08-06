"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase-client";
import { useLocalStorage } from "usehooks-ts";
import PredictiveAnalytics from "@/components/predictive/PredictiveAnalytics";
import { PredictiveSidebar } from "@/components/sidebar/predictive";
import type {
  Chat,
  Message,
  Attachment,
} from "@/components/predictive/PredictiveTypes";
import type { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StudioWelcome } from "@/components/predictive/PredictiveWelcome";
import jsPDF from "jspdf";
import { useThinking } from "@/hooks/useThinking";
import { useTheme } from "@/context/ThemeContext";
import { motion } from "framer-motion";

const REVALIDATION_INTERVAL = 5 * 60 * 1000;

export default function StudioPage() {
  const router = useRouter();
  const supabase = createClient();
  const { theme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [shouldLoadChats, setShouldLoadChats] = useState(true);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  const [pendingChatName, setPendingChatName] = useState<string | null>(null);
  const [deletedChatIds, setDeletedChatIds] = useState<Set<string>>(new Set());
  const [deletingChatIds, setDeletingChatIds] = useState<Set<string>>(
    new Set()
  );

  // ✅ ESTADO ESTABLE: Una sola fuente de verdad para el mensaje optimista
  const [persistentOptimisticMessage, setPersistentOptimisticMessage] =
    useState<Message | null>(null);
  // ✅ ESTADO ESTABLE: Evitar cambios de sessionId durante transición
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSendRefCallback = useRef<
    ((message: string, attachments?: Attachment[]) => Promise<void>) | null
  >(null);

  const setHandleSendRef = useCallback(
    (fn: (message: string, attachments?: Attachment[]) => Promise<void>) => {
      handleSendRefCallback.current = fn;
    },
    []
  );

  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);

  const [currentThinkingSession, setCurrentThinkingSession] = useState<{
    sessionId: string;
    versionId: number;
  } | null>(null);

  const [pendingAiButtonsState, setPendingAiButtonsState] = useState<{
    reasoning: boolean;
    search: boolean;
    document: boolean;
    agentic: boolean;
  } | null>(null);

  const { thinkingContent, isThinking, isThinkingComplete, finishThinking } =
    useThinking({
      sessionId: currentThinkingSession?.sessionId || null,
      versionId: currentThinkingSession?.versionId || 0,
      isThinkingActive: !!currentThinkingSession,
      hookInstance: "page.tsx",
    });

  const pendingMessageRef = useRef<{
    message: string;
    attachments: Attachment[];
  } | null>(null);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [autoRevalidate, setAutoRevalidate] = useLocalStorage<boolean>(
    "hestiaAutoRevalidate",
    false
  );

  // 🆕 ESTADO PARA DETECTAR SI HAY CANVAS ABIERTO
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => !deletedChatIds.has(chat.session_id));
  }, [chats, deletedChatIds]);

  const shouldShowWelcome = useMemo(() => {
    return showWelcomeScreen || !currentSessionId || pendingChatName !== null;
  }, [showWelcomeScreen, currentSessionId, pendingChatName]);

  // [Resto de useEffects permanecen igual - omitidos por brevedad]
  useEffect(() => {
    const loadLastSelectedChat = () => {
      try {
        const saved = localStorage.getItem("currentStudioSessionId");
        if (saved && saved !== "null") {
          if (!currentSessionId) {
            setCurrentSessionId(saved);
            setShowWelcomeScreen(false);
          }
        }
      } catch (error) {
        console.error("Error loading last selected chat:", error);
      }
    };

    loadLastSelectedChat();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      try {
        localStorage.setItem("currentStudioSessionId", currentSessionId);
      } catch (error) {
        console.error("Error saving current session:", error);
      }
    }
  }, [currentSessionId]);

  useEffect(() => {
    const checkPendingMessage = () => {
      if (pendingMessageRef.current && handleSendRefCallback.current) {
        console.log("Enviando mensaje pendiente:", pendingMessageRef.current);
        const { message, attachments } = pendingMessageRef.current;
        handleSendRefCallback.current(message, attachments);
        pendingMessageRef.current = null;
      } else if (pendingMessageRef.current) {
        console.log("Mensaje pendiente esperando handleSendRef");
      }
    };

    checkPendingMessage();
    const intervalId = setInterval(checkPendingMessage, 200);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("hestia_user_profiles_new")
          .select("role")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        setCurrentRole(data?.role || null);
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, [user, supabase]);

  const handleError = useCallback((error: unknown, context: string) => {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error(`Error in ${context}:`, error);
    setError(`${context}: ${errorMessage}`);
    setTimeout(() => setError(null), 5000);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        setUser(session.user);
        setAuthLoading(false);
      } catch (error) {
        console.error("Error en verificación:", error);
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (!session) {
          router.push("/login");
        }
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const loadChats = useCallback(async () => {
    if (!user?.id || !shouldLoadChats) return;

    try {
      if (chats.length === 0) {
        setIsLoading(true);
      }

      const { data, error } = await supabase
        .from("hestia_chats")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedChats = data.map((chat: any) => {
        const existingChat = chats.find((c) => c.session_id === chat.id);

        return {
          ...chat,
          session_id: chat.id,
          project_id: chat.project_id || crypto.randomUUID(),
          version_id: chat.version_id || crypto.randomUUID(),
          messages: existingChat?.messages || chat.messages || [],
        };
      });

      setChats((prevChats) => {
        const existingChatsMap = new Map(
          prevChats.map((chat) => [chat.session_id, chat])
        );

        const updatedChats = formattedChats.map((newChat) => {
          const existingChat = existingChatsMap.get(newChat.session_id);
          return existingChat
            ? {
                ...newChat,
                messages:
                  existingChat.messages.length > 0
                    ? existingChat.messages
                    : newChat.messages,
              }
            : newChat;
        });

        return updatedChats;
      });

      setLastUpdate(Date.now());
      setShouldLoadChats(false);
    } catch (error) {
      handleError(error, "Error cargando chats");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, handleError, supabase, shouldLoadChats, chats]);

  useEffect(() => {
    const supabase = createClient();
    if (!user) return;

    const channel = supabase
      .channel("realtime:chats")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hestia_chats",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedChat = payload.new;
          setChats((prev) =>
            prev.map((chat) =>
              chat.session_id === updatedChat.id
                ? { ...chat, name: updatedChat.name, _nameChanged: true }
                : chat
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRoleChange = useCallback(
    async (newRole: string) => {
      if (!user) return;

      try {
        const { error } = await supabase
          .from("hestia_user_profiles_new")
          .update({ role: newRole })
          .eq("id", user.id);

        if (error) throw error;

        setCurrentRole(newRole);
      } catch (error) {
        handleError(error, "Error cambiando rol");
      }
    },
    [user, supabase, handleError]
  );

  const shouldRevalidate = useCallback((): boolean => {
    if (!autoRevalidate) return false;
    return Date.now() - lastUpdate > REVALIDATION_INTERVAL;
  }, [lastUpdate, autoRevalidate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && shouldRevalidate()) {
        setShouldLoadChats(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [shouldRevalidate]);

  useEffect(() => {
    if (user && shouldLoadChats) {
      loadChats();
    }
  }, [user, loadChats, shouldLoadChats, currentSessionId, chats.length]);

  useEffect(() => {
    setShowWelcomeScreen(true);
  }, []);

  const handleNewChat = useCallback(async (): Promise<string | null> => {
    if (isCreatingChat || !user) return null;

    setIsCreatingChat(true);
    // 🆕 Solo colapsar en modo móvil
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }

    try {
      const tempChatName = `Proyecto ${filteredChats.length + 1}`;
      setPendingChatName(tempChatName);
      setCurrentSessionId(null);
      setShowWelcomeScreen(true);
      setCurrentThinkingSession(null);
      setPendingAiButtonsState(null);
      setPersistentOptimisticMessage(null);
      return tempChatName;
    } catch (error) {
      console.error("Error preparando nueva conversación:", error);
      handleError(error, "Error preparando nueva conversación");
      return null;
    } finally {
      setIsCreatingChat(false);
    }
  }, [filteredChats.length, user, handleError, isCreatingChat]);

  // ✅ FUNCIÓN COMPLETAMENTE REESCRITA: Transición estable Welcome → Analytics
  const handleUpdateMessages = useCallback(
    async (session_id: string, messages: Message[]) => {
      console.log("💾 [page.tsx] handleUpdateMessages llamada:", {
        sessionId: session_id,
        messageCount: messages.length,
        hasOptimistic: messages.some((m) => m.isOptimistic),
        hasPersistentOptimistic: !!persistentOptimisticMessage,
        isTransitioning,
      });

      // ✅ NO HACER NADA SI ESTAMOS EN TRANSICIÓN
      if (isTransitioning) {
        console.log("⚠️ [page.tsx] Skipping update during transition");
        return;
      }

      setTimeout(() => {
        setShouldLoadChats(true);
      }, 0);

      try {
        const timestamp = new Date().toISOString();
        const nonOptimisticMessages = messages.filter(
          (msg) => !msg.isOptimistic
        );

        console.log("💾 [page.tsx] Guardando en BD:", {
          total: messages.length,
          nonOptimistic: nonOptimisticMessages.length,
        });

        const { error } = await supabase
          .from("hestia_chats")
          .update({
            messages: nonOptimisticMessages,
            updated_at: timestamp,
          })
          .eq("session_id", session_id);

        if (error) throw error;

        // ✅ ACTUALIZAR ESTADO LOCAL CON MENSAJE PERSISTENTE
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.session_id === session_id) {
              let finalMessages = [...nonOptimisticMessages];

              // ✅ INCLUIR MENSAJE PERSISTENTE SI EXISTE Y NO HAY VERSIÓN REAL
              if (
                persistentOptimisticMessage &&
                session_id === currentSessionId
              ) {
                const hasRealUserMessage = nonOptimisticMessages.some(
                  (msg) =>
                    msg.role === "user" &&
                    msg.content === persistentOptimisticMessage.content
                );
                if (!hasRealUserMessage) {
                  finalMessages = [
                    persistentOptimisticMessage,
                    ...finalMessages,
                  ];
                  console.log("✅ [page.tsx] Mensaje persistente preservado");
                } else {
                  // El mensaje optimista ya fue reemplazado, limpiar
                  setPersistentOptimisticMessage(null);
                  console.log(
                    "🧹 [page.tsx] Mensaje persistente reemplazado por mensaje real"
                  );
                }
              }

              finalMessages.sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

              return {
                ...chat,
                messages: finalMessages,
                updated_at: timestamp,
              };
            }
            return chat;
          })
        );
      } catch (error) {
        handleError(error, "Error actualizando mensajes");
      }
    },
    [
      handleError,
      supabase,
      persistentOptimisticMessage,
      currentSessionId,
      isTransitioning,
    ]
  );

  const handleEditChatName = useCallback(
    async (session_id: string, newName: string) => {
      try {
        const { error } = await supabase
          .from("hestia_chats")
          .update({ name: newName })
          .eq("session_id", session_id);

        if (error) throw error;

        setChats((prev) =>
          prev.map((chat) =>
            chat.session_id === session_id ? { ...chat, name: newName } : chat
          )
        );
      } catch (error) {
        handleError(error, "Error actualizando nombre");
      }
    },
    [handleError, supabase]
  );

  const handleDeleteChat = useCallback(
    async (session_id: string) => {
      setDeletingChatIds((prev) => new Set(prev).add(session_id));
      setDeletedChatIds((prev) => new Set(prev).add(session_id));

      if (currentSessionId === session_id) {
        const remainingChats = filteredChats.filter(
          (chat) => chat.session_id !== session_id
        );
        if (remainingChats.length > 0) {
          setCurrentSessionId(remainingChats[0]?.session_id || null);
        } else {
          setCurrentSessionId(null);
          setShowWelcomeScreen(true);
        }
      }

      try {
        const response = await fetch("/api/delete-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session_id, user_id: user?.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error ${response.status}: ${errorText}`);
        }

        setChats((prev) =>
          prev.filter((chat) => chat.session_id !== session_id)
        );

        setTimeout(() => {
          setShouldLoadChats(true);
        }, 1000);
      } catch (error) {
        console.error("❌ Error eliminando chat:", error);

        setDeletedChatIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(session_id);
          return newSet;
        });

        if (currentSessionId === null || currentSessionId === session_id) {
          setCurrentSessionId(session_id);
          setShowWelcomeScreen(false);
        }

        handleError(error, "Error eliminando chat");
      } finally {
        setDeletingChatIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(session_id);
          return newSet;
        });
      }
    },
    [currentSessionId, filteredChats, handleError]
  );

  const handleExportChat = useCallback(
    async (session_id: string) => {
      try {
        const { data, error } = await supabase
          .from("hestia_chats")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (error) throw error;

        if (!data || !data.messages || !Array.isArray(data.messages)) {
          throw new Error("No hay mensajes válidos para exportar");
        }

        const messages = data.messages;
        const doc = new jsPDF();

        let y = 10;
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;

        const addText = (text: string, options = {}) => {
          const splitText = doc.splitTextToSize(text, 180);
          for (const line of splitText) {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = 10;
            }
            doc.text(line, 10, y, options);
            y += lineHeight;
          }
        };

        const chatName = data.name ?? session_id;
        addText(`Chat exportado - ${chatName}`, { fontStyle: "bold" });
        y += lineHeight;

        let i = 0;
        while (i < messages.length) {
          const userMsg = messages[i];
          if (userMsg.role !== "user") {
            i++;
            continue;
          }

          addText("Usuario:", { fontStyle: "bold" });
          addText(userMsg.content);

          if (userMsg.attachments && userMsg.attachments.length > 0) {
            const attachmentsNames = userMsg.attachments
              .map((att: any) => att.name)
              .filter(Boolean)
              .join(", ");
            addText(`Archivos adjuntos: ${attachmentsNames}`);
          }

          if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
            addText("Asistente:", { fontStyle: "bold" });
            addText(messages[i + 1].content);
            i += 2;
          } else {
            i += 1;
          }

          addText("----------------------------------------");
        }

        doc.save(`hestia_chat-${session_id}.pdf`);
      } catch (error) {
        handleError(error, "Error exportando chat");
      }
    },
    [handleError, supabase]
  );

  // ✅ FUNCIÓN MEJORADA: Selección de chat estable
  const handleSelectChat = useCallback(
    (sessionId: string | null) => {
      console.log("🔄 [page.tsx] handleSelectChat:", {
        sessionId,
        isTransitioning,
      });

      // ✅ NO CAMBIAR DURANTE TRANSICIÓN
      if (isTransitioning) {
        console.log("⚠️ [page.tsx] Skipping chat selection during transition");
        return;
      }

      // 🆕 Solo colapsar en modo móvil
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true);
      }

      setCurrentSessionId(sessionId);
      setShowWelcomeScreen(false);
      setPendingAiButtonsState(null);
      setCurrentThinkingSession(null);
      setPendingChatName(null);

      // ✅ SOLUCIÓN CRÍTICA: Limpiar mensaje persistente si no pertenece a la nueva sesión
      if (
        persistentOptimisticMessage &&
        persistentOptimisticMessage.session_id !== sessionId
      ) {
        console.log(
          "🧹 [page.tsx] Clearing persistent optimistic message from different session"
        );
        setPersistentOptimisticMessage(null);
      }
    },
    [isTransitioning, persistentOptimisticMessage]
  );

  // ✅ SOLUCIÓN PRINCIPAL: Computed chat actual con verificación estricta de sesión
  const currentChat = useMemo(() => {
    if (filteredChats.length === 0 || !currentSessionId) {
      return null;
    }

    const baseChat = filteredChats.find(
      (chat) => chat.session_id === currentSessionId
    );
    if (!baseChat) return null;

    // ✅ SOLUCIÓN CRÍTICA: Solo incluir mensaje persistente si pertenece a la sesión actual
    if (
      persistentOptimisticMessage &&
      currentSessionId &&
      persistentOptimisticMessage.session_id === currentSessionId // ✅ VERIFICACIÓN CRÍTICA
    ) {
      const hasOptimisticMessage = baseChat.messages.some(
        (msg) => msg.id === persistentOptimisticMessage.id
      );

      if (!hasOptimisticMessage) {
        console.log(
          "✅ [page.tsx] Including persistent optimistic message for correct session:",
          currentSessionId
        );
        return {
          ...baseChat,
          messages: [persistentOptimisticMessage, ...baseChat.messages],
        };
      }
    } else if (
      persistentOptimisticMessage &&
      persistentOptimisticMessage.session_id !== currentSessionId
    ) {
      // ✅ LIMPIAR MENSAJE PERSISTENTE SI NO PERTENECE A LA SESIÓN ACTUAL
      console.log(
        "🧹 [page.tsx] Persistent message belongs to different session, cleaning up"
      );
      setPersistentOptimisticMessage(null);
    }

    return baseChat;
  }, [filteredChats, currentSessionId, persistentOptimisticMessage]);

  // ✅ FUNCIÓN COMPLETAMENTE REESCRITA: Transición estable Welcome → Analytics
  const handleWelcomeMessage = useCallback(
    async (
      message: string,
      role?: string,
      attachments?: Attachment[],
      aiButtonsState?: {
        reasoning: boolean;
        search: boolean;
        document: boolean;
        agentic: boolean;
      }
    ): Promise<void> => {
      try {
        console.log("📝 [page.tsx] Procesando mensaje de bienvenida:", {
          message,
          role,
          aiButtonsState,
        });

        // ✅ ACTIVAR MODO TRANSICIÓN
        setIsTransitioning(true);

        // ✅ OBTENER MENSAJE OPTIMISTA DE WELCOME
        let optimisticMessage: Message | null = null;
        if (
          typeof window !== "undefined" &&
          (window as any).__welcomeOptimisticMessage
        ) {
          optimisticMessage = (window as any).__welcomeOptimisticMessage;
          delete (window as any).__welcomeOptimisticMessage;
        }

        if (role) {
          await handleRoleChange(role);
        }

        const timestamp = new Date().toISOString();
        const sessionId = crypto.randomUUID();
        const chatName =
          pendingChatName || `Proyecto ${filteredChats.length + 1}`;

        console.log("💾 [page.tsx] Creando chat en Supabase:", {
          sessionId,
          chatName,
        });

        const { data: newChat, error } = await supabase
          .from("hestia_chats")
          .insert([
            {
              id: sessionId,
              session_id: sessionId,
              name: chatName,
              user_id: user!.id,
              messages: [],
              created_at: timestamp,
              updated_at: timestamp,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("Error detallado al crear chat:", error);
          throw error;
        }

        console.log("✅ [page.tsx] Chat creado exitosamente:", newChat);

        // ✅ ACTUALIZAR MENSAJE OPTIMISTA CON DATOS REALES Y GUARDARLO PERSISTENTEMENTE
        if (optimisticMessage) {
          const updatedOptimisticMessage = {
            ...optimisticMessage,
            session_id: newChat.session_id,
            project_id: newChat.project_id || crypto.randomUUID(),
          };
          setPersistentOptimisticMessage(updatedOptimisticMessage);
          console.log(
            "✅ [page.tsx] Mensaje optimista guardado persistentemente"
          );
        }

        const emptyChat = {
          ...newChat,
          messages: [],
        };

        setPendingChatName(null);
        setChats((prev) => [
          emptyChat,
          ...prev.filter((c) => c.session_id !== newChat.session_id),
        ]);

        // ✅ CAMBIAR SESIÓN Y SALIR DE WELCOME DE FORMA ATÓMICA
        setCurrentSessionId(newChat.session_id);
        setShowWelcomeScreen(false);

        if (aiButtonsState) {
          console.log(
            "💾 [page.tsx] Guardando estados de botones desde Welcome:",
            aiButtonsState
          );
          setPendingAiButtonsState(aiButtonsState);
        }

        if (aiButtonsState?.reasoning) {
          console.log(
            "🧠 [page.tsx] Activando thinking session desde Welcome:",
            {
              sessionId: newChat.session_id,
              versionId: 0,
              reasoning: aiButtonsState.reasoning,
            }
          );

          setCurrentThinkingSession({
            sessionId: newChat.session_id,
            versionId: 0,
          });
        }

        // ✅ ESPERAR A QUE EL COMPONENTE SE MONTE ANTES DE ENVIAR
        await new Promise((resolve) => setTimeout(resolve, 100));

        // ✅ DESACTIVAR MODO TRANSICIÓN ANTES DE ENVIAR
        setIsTransitioning(false);

        try {
          const titleResponse = await fetch("/api/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              session_id: newChat.session_id,
            }),
          });
        } catch (error) {
          console.error("Error generando título:", error);
        }

        // ✅ ESPERAR A QUE handleSendRef ESTÉ DISPONIBLE
        let attempts = 0;
        while (!handleSendRefCallback.current && attempts < 50) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (handleSendRefCallback.current) {
          console.log(
            "📤 [page.tsx] Enviando mensaje con handleSendRef, estados de botones:",
            aiButtonsState
          );

          if (typeof window !== "undefined") {
            (window as any).__aiButtonsStateFromWelcome = {
              reasoning: aiButtonsState?.reasoning === true,
              search: aiButtonsState?.search === true,
              document: aiButtonsState?.document === true,
              agentic: aiButtonsState?.agentic === true,
            };
            (window as any).__isFirstMessage = true;
          }

          await handleSendRefCallback.current(message, attachments || []);

          if (typeof window !== "undefined") {
            delete (window as any).__aiButtonsStateFromWelcome;
            delete (window as any).__isFirstMessage;
          }
        } else {
          console.warn(
            "🚨 [page.tsx] HandleSendRef no disponible después de 5 segundos"
          );
          throw new Error("HandleSendRef no disponible");
        }

        setTimeout(() => {
          console.log("🧹 [page.tsx] Limpiando thinking session");
          setCurrentThinkingSession(null);
        }, 5000);
      } catch (error) {
        console.error(
          "❌ [page.tsx] Error completo al enviar mensaje de bienvenida:",
          error
        );
        handleError(error, "Error al enviar mensaje inicial");

        // ✅ LIMPIAR ESTADO EN CASO DE ERROR
        setIsTransitioning(false);
        setPendingChatName(null);
        setShowWelcomeScreen(true);
        setCurrentSessionId(null);
        setPersistentOptimisticMessage(null);
      }
    },
    [
      pendingChatName,
      filteredChats.length,
      user,
      supabase,
      handleRoleChange,
      handleError,
    ]
  );

  return (
    <div className="flex min-h-screen">
      {error && (
        <div className="absolute top-4 right-4 bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-md shadow-lg z-50 animate-in slide-in-from-top duration-300">
          {error}
        </div>
      )}

      <aside
        className={`flex-shrink-0 transition-all duration-300 ${
          isSidebarCollapsed ? "w-0" : "w-[280px]"
        }`}
      >
        {!authLoading && (
          <PredictiveSidebar
            chats={filteredChats}
            currentSessionId={currentSessionId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onEditChatName={handleEditChatName}
            onDeleteChat={handleDeleteChat}
            onExportChat={handleExportChat}
            currentRole={currentRole}
            onRoleChange={handleRoleChange}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            user={user}
            deletingChatIds={deletingChatIds}
            pendingChatName={pendingChatName}
          />
        )}
      </aside>

      <main className="flex-1 relative">
        {/* 🆕 ELEMENTOS FIJOS CON Z-INDEX CONDICIONAL */}
        <div
          className={`fixed top-2 right-4 flex items-center space-x-2 bg-transparent transition-all duration-300`}
          style={{
            zIndex: isCanvasOpen ? 35 : 30, // 🆕 Z-INDEX DINÁMICO BASADO EN ESTADO DEL CANVAS
          }}
        >
          <a
            href="https://aria-studio.garagedeepanalytics.com/form/hestia3-bugs"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs px-3 py-1 border bg-background ${
              theme == "dark"
                ? "border-card hover:bg-card"
                : "border-muted hover:bg-muted"
            } border-muted rounded-md bg-muted/ transition-colors`}
          >
            Reportar bug o sugerencia
          </a>
          <ThemeToggle />
        </div>

        {!authLoading && (
          <>
            {shouldShowWelcome ? (
              <StudioWelcome
                onSendMessage={handleWelcomeMessage}
                user={user}
                currentRole={currentRole}
                onRoleChange={handleRoleChange}
                thinkingContent={thinkingContent}
                isThinking={isThinking}
                isThinkingComplete={isThinkingComplete}
                pendingChatName={pendingChatName}
              />
            ) : (
              currentChat && (
                <PredictiveAnalytics
                  setHandleSendRef={setHandleSendRef}
                  session_id={currentChat.session_id}
                  messages={currentChat.messages || []}
                  onUpdateMessages={handleUpdateMessages}
                  onNewChat={handleNewChat}
                  onChatNameUpdate={handleEditChatName}
                  isCollapsed={isSidebarCollapsed}
                  project_id={currentChat.project_id}
                  version_id={currentChat.version_id}
                  thinkingSession={currentThinkingSession}
                  isThinkingFromWelcome={!!currentThinkingSession}
                  initialAiButtonsState={pendingAiButtonsState || undefined}
                  externalThinkingContent={thinkingContent}
                  externalIsThinking={isThinking}
                  externalIsThinkingComplete={isThinkingComplete}
                />
              )
            )}
          </>
        )}
      </main>

      {((isLoading && chats.length === 0) || (authLoading && !user)) && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2">
            <motion.img
              src={
                theme === "light"
                  ? "/images/loading-light.gif"
                  : "/images/loading-dark.gif"
              }
              alt="Logo animado de carga"
              className="w-9 h-9"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
            <p className="text-muted-foreground">Cargando</p>
          </div>
        </div>
      )}
    </div>
  );
}
