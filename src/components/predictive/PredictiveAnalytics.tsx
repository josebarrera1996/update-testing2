"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import PredictiveInput from "./PredictiveInput";
import { MessageList } from "./MessageList";
import { CodeCanvas } from "./CodeCanvas";
import { DragDropOverlay } from "./DragDropOverlay";
import type { Message, PredictiveAnalyticsProps } from "./PredictiveTypes";
import { usePredictive } from "@/hooks/usePredictive";
import { useTheme } from "@/context/ThemeContext";
import type { User } from "@supabase/supabase-js";
import { useLoadingState } from "@/hooks/useLoadingState";

export function PredictiveAnalytics({
  session_id: initialSessionId,
  messages: initialMessages,
  onUpdateMessages,
  onNewChat,
  project_id,
  isCollapsed,
  version_id,
  setHandleSendRef,
  onChatNameUpdate = () => Promise.resolve(),
  thinkingSession,
  isThinkingFromWelcome,
  externalThinkingContent,
  externalIsThinking,
  externalIsThinkingComplete,
  initialAiButtonsState,
}: PredictiveAnalyticsProps & {
  externalThinkingContent?: string;
  externalIsThinking?: boolean;
  externalIsThinkingComplete?: boolean;
  initialAiButtonsState?: {
    reasoning: boolean;
    search: boolean;
    document: boolean;
    agentic: boolean;
  };
}) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialSessionId
  );
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [lastMessageWasUser, setLastMessageWasUser] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const activeSessionRef = useRef<string | null>(null);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (initialSessionId !== activeSessionRef.current) {
      console.log(
        `🔄 PredictiveAnalytics: Cambiando sesión activa de ${activeSessionRef.current} a ${initialSessionId}`
      );
      activeSessionRef.current = initialSessionId;

      if (isEditorOpen) {
        console.log("🔒 Cerrando canvas al cambiar de sesión");
        setIsEditorOpen(false);
        setCurrentMessage(null);
        setIsEditorExpanded(false);
      }
    }
  }, [initialSessionId, isEditorOpen]);

  useEffect(() => {
    if (initialSessionId !== currentSessionId) {
      setCurrentSessionId(initialSessionId);
    }
  }, [initialSessionId, currentSessionId]);

  // ✅ NUEVO: Incluir manejo de errores
  const {
    isLoading: isSupabaseLoading,
    hasError, // ✅ NUEVO
    errorMessage, // ✅ NUEVO
    failedMessage, // ✅ NUEVO
    handleSendError, // ✅ NUEVO
    clearError, // ✅ NUEVO
    startWatching,
    stopWatching,
    checkCurrentState,
  } = useLoadingState({
    sessionId: currentSessionId,
    sessionValidator: (sessionId) => sessionId === activeSessionRef.current,
  });

  const {
    messages,
    visibleMessages,
    hasMoreMessages,
    isLoadingMore,
    allMessagesLoaded,
    loadMoreMessages,
    restoreScrollPosition,
    calculateCorrectVersionId,

    attachments,
    isDragging,
    handleFileUpload,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    removeAttachment,
    input,
    setInput,
    aiButtonsState,
    handleButtonStateChange,
    handleSend,
    handleRetry,
    lastOptimisticMessage,
    thinkingContent,
    isThinking,
    isThinkingComplete,
    finishThinking,
    isReasoningActive,
    savedThinkingContent,

    editingMessageId,
    editedContent,
    isEditLoading,
    setEditedContent,
    startEdit,
    cancelEdit,
    saveEdit,
    isEditing,
    isLoading: isLocalLoading,
  } = usePredictive({
    initialMessages,
    sessionId: currentSessionId,
    projectId: project_id,
    userId: user?.id,
    onUpdateMessages,
    onNewChat,
    onChatNameUpdate,
    thinkingSession,
    isThinkingFromWelcome,
    initialAiButtonsState,
    externalThinkingContent,
    externalIsThinking,
    externalIsThinkingComplete,
    startWatching,
    stopWatching,
    // Adapt handleSendError to expected signature
    handleSendError: (error: Error, sessionId: string, message: Message) => {
      void handleSendError(sessionId, error.message, message);
    },
    activeSessionRef,
  });

  const isLoading = useCallback(() => {
    if (currentSessionId !== activeSessionRef.current) {
      return false;
    }
    return isLocalLoading || isSupabaseLoading;
  }, [isLocalLoading, isSupabaseLoading, currentSessionId]);

  useEffect(() => {
    return () => {
      if (currentSessionId) {
        console.log(
          `🧹 PredictiveAnalytics: Limpiando estado para sesión ${currentSessionId}`
        );
        stopWatching();
      }
    };
  }, [currentSessionId, stopWatching]);

  const finalThinkingContent = externalThinkingContent || thinkingContent;
  const finalIsThinking =
    externalIsThinking !== undefined ? externalIsThinking : isThinking;
  const finalIsThinkingComplete =
    externalIsThinkingComplete !== undefined
      ? externalIsThinkingComplete
      : isThinkingComplete;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsEditorOpen(false);
        setCurrentMessage(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsEditorOpen(false);
        setCurrentMessage(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (visibleMessages.length > 0 && chatContainerRef.current) {
      const scrollToEnd = () => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop =
            chatContainerRef.current.scrollHeight;
        }
      };

      scrollToEnd();
      setTimeout(scrollToEnd, 0);
      setTimeout(scrollToEnd, 100);
    }
  }, [currentSessionId, visibleMessages.length]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isEditorOpen) {
        setIsEditorOpen(false);
        setCurrentMessage(null);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isEditorOpen]);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop =
            chatContainerRef.current.scrollHeight;
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!isLoadingMore && chatContainerRef.current) {
      restoreScrollPosition(chatContainerRef.current);
    }
  }, [isLoadingMore, restoreScrollPosition]);

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const distanceFromTop = scrollTop;

    const isScrollingUp = scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    setShowScrollButton(distanceFromBottom > 200);

    if (
      distanceFromTop < 150 &&
      isScrollingUp &&
      !isLoadingMore &&
      hasMoreMessages
    ) {
      loadMoreMessages(chatContainerRef.current);
    }
  }, [isLoadingMore, hasMoreMessages, loadMoreMessages]);

  useEffect(() => {
    if (visibleMessages.length > 0) {
      const lastMessage = visibleMessages[visibleMessages.length - 1];
      setLastMessageWasUser(lastMessage.role === "user");
    }
  }, [visibleMessages]);

  useEffect(() => {
    if (setHandleSendRef) {
      setHandleSendRef(handleSend);
    }
  }, [handleSend, setHandleSendRef]);

  const ScrollToBottomButton = () => (
    <button
      className={`fixed ${
        isMobile ? "bottom-20 right-4" : "bottom-24 right-8"
      } bg-primary hover:bg-primary/80 text-white rounded-full p-2 sm:p-3 shadow-lg z-50 transition-all duration-300`}
      onClick={scrollToBottom}
      aria-label="Scroll to bottom"
      style={{
        opacity: showScrollButton ? 0.9 : 0,
        transform: showScrollButton ? "scale(1)" : "scale(0.8)",
        pointerEvents: showScrollButton ? "auto" : "none",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 sm:h-6 sm:w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    </button>
  );

  const currentIsLoading = isLoading();

  // ✅ NUEVO: Funciones para manejar errores
  const handleRetryError = useCallback(async () => {
    if (failedMessage) {
      console.log("🔄 Retrying failed message:", failedMessage);

      // ✅ IMPORTANTE: Limpiar el error antes del retry
      if (currentSessionId && clearError) {
        await clearError(currentSessionId);
      }

      // Pequeña pausa para asegurar que el estado se actualice
      setTimeout(() => {
        handleRetry(failedMessage.content, failedMessage.attachments);
      }, 100);
    } else {
      console.warn("⚠️ No failed message to retry");
    }
  }, [failedMessage, handleRetry, currentSessionId, clearError]);

  return (
    <div
      className="flex flex-col h-screen transition-all duration-300 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-session-id={currentSessionId}
      data-active-session={activeSessionRef.current}
    >
      <DragDropOverlay isDragging={isDragging} />

      <div className="flex-1 relative">
        <div
          className={`h-full flex flex-col transition-all duration-300 ${
            isEditorOpen && !isMobile
              ? isEditorExpanded
                ? "mr-[75%]"
                : "mr-[45%]"
              : ""
          }`}
        >
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto relative"
            onScroll={handleScroll}
          >
            <MessageList
              messages={visibleMessages}
              isLoading={currentIsLoading}
              hasError={hasError} // ✅ NUEVO
              errorMessage={errorMessage} // ✅ NUEVO
              onRetryError={handleRetryError} // ✅ NUEVO
              isLoadingMore={isLoadingMore}
              hasMoreMessages={hasMoreMessages}
              allMessagesLoaded={allMessagesLoaded}
              isEditorOpen={isEditorOpen}
              isCollapsed={isCollapsed}
              isMobile={isMobile}
              theme={theme}
              supabase={supabase}
              calculateCorrectVersionId={calculateCorrectVersionId}
              handleRetry={handleRetry}
              setCurrentMessage={setCurrentMessage}
              setIsEditorOpen={setIsEditorOpen}
              setIsEditorExpanded={setIsEditorExpanded}
              onScroll={handleScroll}
              isReasoningActive={isReasoningActive}
              thinkingContent={savedThinkingContent}
              isThinkingComplete={finalIsThinkingComplete}
              isThinking={finalIsThinking}
              thinkingContentRealtime={thinkingContent}
              lastMessageWasUser={lastMessageWasUser}
              sessionId={currentSessionId}
              externalThinkingContent={externalThinkingContent}
              externalIsThinking={externalIsThinking}
              editingMessageId={editingMessageId}
              editedContent={editedContent}
              isEditLoading={isEditLoading}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              setEditedContent={setEditedContent}
              activeSessionRef={activeSessionRef}
            />
          </div>

          <div ref={inputContainerRef} className="px-2 sm:px-4 lg:px-6">
            <PredictiveInput
              input={input}
              setInput={setInput}
              attachments={attachments}
              project_id={project_id}
              isCollapsed={isCollapsed}
              session_id={currentSessionId || ""}
              version_id={Number.parseInt(version_id.toString())}
              removeAttachment={removeAttachment}
              handleSend={handleSend}
              handleFileUpload={handleFileUpload}
              isLoading={currentIsLoading}
              isGenerating={false}
              stopGenerating={() => {}}
              uploadedFilesCount={attachments.length}
              aiButtonsState={aiButtonsState}
              onButtonStateChange={handleButtonStateChange}
            />

            <div ref={messagesEndRef} />
          </div>
        </div>

        <ScrollToBottomButton />

        {/* Canvas - Solo en desktop */}
        {isEditorOpen &&
          !isMobile &&
          currentMessage &&
          (currentMessage as any).code && (
            <div
              className="absolute right-0 top-0 h-full bg-[#1e1e1e] shadow-xl border-l border-gray-800 transition-all duration-300"
              style={{
                width: isEditorExpanded ? "75%" : "45%",
                zIndex: 40,
              }}
            >
              <CodeCanvas
                codeUrls={(currentMessage as any).code}
                sessionId={currentSessionId || ""}
                versionId={currentMessage.version_id}
                onClose={() => {
                  setIsEditorOpen(false);
                  setCurrentMessage(null);
                }}
                isExpanded={isEditorExpanded}
                onToggleExpand={() => setIsEditorExpanded(!isEditorExpanded)}
              />
            </div>
          )}
      </div>
    </div>
  );
}

export default PredictiveAnalytics;
