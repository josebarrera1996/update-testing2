"use client";

import type React from "react";
import { useEffect, useRef, memo, useMemo } from "react";
import { PredictiveUser } from "./PredictiveUser";
import { PredictiveResponse } from "./PredictiveResponse";
import type { Message, Attachment } from "./PredictiveTypes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PredictiveLoading } from "./PredictiveLoading";
import { ThinkingDisplay } from "./ThinkingDisplay";
import { PredictiveError } from "./PredictiveError";
// ✅ NUEVO componente

const LoadingMoreMessages = memo(() => (
  <div className="flex justify-center py-4 sm:py-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
    <div className="flex items-center space-x-3 text-muted-foreground">
      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
      <span className="text-xs sm:text-sm font-medium">
        Cargando más mensajes...
      </span>
    </div>
  </div>
));

LoadingMoreMessages.displayName = "LoadingMoreMessages";

const AllMessagesLoaded = memo(() => (
  <div className="flex justify-center py-2 sm:py-4 text-xs sm:text-sm text-muted-foreground"></div>
));

AllMessagesLoaded.displayName = "AllMessagesLoaded";

const MessageItem = memo(
  ({
    message,
    index,
    isMobile,
    isEditorOpen,
    isCollapsed,
    supabase,
    calculateCorrectVersionId,
    handleRetry,
    setCurrentMessage,
    setIsEditorOpen,
    setIsEditorExpanded,
    isThinkingComplete,
    editingMessageId,
    editedContent,
    isEditLoading,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    setEditedContent,
  }: {
    message: Message;
    index: number;
    isMobile: boolean;
    isEditorOpen: boolean;
    isCollapsed: boolean;
    supabase: SupabaseClient;
    calculateCorrectVersionId: (message: Message) => number;
    handleRetry: (content: string, attachments?: Attachment[]) => void;
    setCurrentMessage: (message: Message | null) => void;
    setIsEditorOpen: (isOpen: boolean) => void;
    setIsEditorExpanded: (isExpanded: boolean) => void;
    isThinkingComplete: boolean;
    editingMessageId?: string | null;
    editedContent?: string;
    isEditLoading?: boolean;
    onStartEdit?: (messageId: string, content: string) => void;
    onSaveEdit?: () => void;
    onCancelEdit?: () => void;
    setEditedContent?: (content: string) => void;
  }) => {
    const handleOpenCanvas = useMemo(
      () => () => {
        const calculatedVersionId = calculateCorrectVersionId(message);
        setCurrentMessage({
          ...message,
          version_id: calculatedVersionId,
        });
        setIsEditorOpen(true);
        setIsEditorExpanded(false);
      },
      [
        message,
        calculateCorrectVersionId,
        setCurrentMessage,
        setIsEditorOpen,
        setIsEditorExpanded,
      ]
    );

    const handleMessageRetry = useMemo(
      () => () => handleRetry(message.content, message.attachments),
      [handleRetry, message.content, message.attachments]
    );

    if (message.role === "user") {
      return (
        <div
          className={`flex ${
            isMobile ? "justify-end pr-0" : "justify-end pr-4 sm:pr-20"
          }`}
        >
          <div
            className={`${
              isEditorOpen && !isMobile
                ? "w-[60%]"
                : "w-full max-w-[85%] sm:max-w-[70%]"
            }`}
          >
            <PredictiveUser
              content={message.content}
              timestamp={message.timestamp}
              attachments={message.attachments}
              error={message.error}
              errorMessage={message.errorMessage}
              project_id={message.project_id}
              session_id={message.session_id}
              version_id={message.version_id}
              onRetry={handleMessageRetry}
              isOptimistic={message.isOptimistic}
              onEdit={() => onStartEdit?.(message.id, message.content)}
              isEditing={editingMessageId === message.id}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              isEditLoading={isEditLoading}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex justify-start ${
          isCollapsed && !isMobile ? "pl-14" : "pl-0"
        } border-border w-full pb-4`}
      >
        <div className={`${isEditorOpen && !isMobile ? "w-[90%]" : "w-full"}`}>
          <PredictiveResponse
            content={message.content}
            error={message.error}
            timestamp={message.timestamp}
            prediction={message.prediction}
            project_id={message.project_id}
            supabaseClient={supabase}
            session_id={message.session_id}
            version_id={calculateCorrectVersionId(message)}
            isCollapsed={isCollapsed}
            showReasoningButton={isThinkingComplete}
            thinking={message.thinking}
            onOpenCanvas={handleOpenCanvas}
            code={(message as any).code}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.isOptimistic === nextProps.message.isOptimistic &&
      prevProps.isEditorOpen === nextProps.isEditorOpen &&
      prevProps.isCollapsed === nextProps.isCollapsed &&
      prevProps.isThinkingComplete === nextProps.isThinkingComplete &&
      prevProps.editingMessageId === nextProps.editingMessageId &&
      prevProps.editedContent === nextProps.editedContent &&
      prevProps.isEditLoading === nextProps.isEditLoading &&
      JSON.stringify((prevProps.message as any).code) ===
        JSON.stringify((nextProps.message as any).code)
    );
  }
);

MessageItem.displayName = "MessageItem";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasError?: boolean; // ✅ NUEVO
  errorMessage?: string; // ✅ NUEVO
  onRetryError?: () => void; // ✅ NUEVO
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  allMessagesLoaded?: boolean;
  isEditorOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  theme: string;
  supabase: SupabaseClient;
  calculateCorrectVersionId: (message: Message) => number;
  handleRetry: (content: string, attachments?: Attachment[]) => void;
  setCurrentMessage: (message: Message | null) => void;
  setIsEditorOpen: (isOpen: boolean) => void;
  setIsEditorExpanded: (isExpanded: boolean) => void;
  onScroll: () => void;
  isReasoningActive?: boolean;
  thinkingContent: string;
  isThinkingComplete: boolean;
  isThinking: boolean;
  lastMessageWasUser: boolean;
  sessionId: string | null;
  thinkingContentRealtime?: string;
  externalThinkingContent?: string;
  externalIsThinking?: boolean;
  editingMessageId?: string | null;
  editedContent?: string;
  isEditLoading?: boolean;
  onStartEdit?: (messageId: string, content: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  setEditedContent?: (content: string) => void;
  activeSessionRef?: React.RefObject<string | null>;
}

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  hasError = false, // ✅ NUEVO
  errorMessage, // ✅ NUEVO
  onRetryError, // ✅ NUEVO
  isLoadingMore,
  hasMoreMessages,
  allMessagesLoaded = false,
  isEditorOpen,
  isCollapsed,
  isMobile,
  theme,
  supabase,
  calculateCorrectVersionId,
  handleRetry,
  setCurrentMessage,
  setIsEditorOpen,
  setIsEditorExpanded,
  onScroll,
  isReasoningActive = false,
  thinkingContent,
  isThinkingComplete,
  isThinking,
  thinkingContentRealtime,
  lastMessageWasUser,
  sessionId,
  externalThinkingContent,
  externalIsThinking,
  editingMessageId,
  editedContent,
  isEditLoading,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  setEditedContent,
  activeSessionRef,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionId !== currentSessionRef.current) {
      console.log("🔄 MessageList: Session changed, resetting loading state");
      currentSessionRef.current = sessionId;

      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }
  }, [sessionId]);

  const finalThinkingContent = useMemo(
    () => externalThinkingContent || thinkingContentRealtime || thinkingContent,
    [externalThinkingContent, thinkingContentRealtime, thinkingContent]
  );

  const finalIsThinking = useMemo(
    () => (externalIsThinking !== undefined ? externalIsThinking : isThinking),
    [externalIsThinking, isThinking]
  );

  // ✅ MEJORADO: Lógica de shouldShowLoading que considera errores
  const shouldShowLoading = useMemo(() => {
    if (
      !sessionId ||
      (activeSessionRef && sessionId !== activeSessionRef.current)
    ) {
      return false;
    }

    const hasOptimisticUser = messages.some(
      (m) => m.role === "user" && m.isOptimistic && m.session_id === sessionId
    );
    const lastMessage = messages[messages.length - 1];
    const lastIsUserOptimistic =
      lastMessage?.role === "user" &&
      lastMessage?.isOptimistic &&
      lastMessage?.session_id === sessionId;

    // ✅ MODIFICADO: Mostrar loading si está loading, incluso si hay error (para retry)
    const shouldShow = isLoading || hasOptimisticUser || lastIsUserOptimistic;

    console.log("🔄 MessageList shouldShowLoading:", {
      sessionId,
      activeSession: activeSessionRef?.current,
      isLoading,
      hasOptimisticUser,
      lastIsUserOptimistic,
      hasError,
      shouldShow,
    });

    return shouldShow;
  }, [isLoading, messages, sessionId, activeSessionRef, hasError]);

  // ✅ NUEVO: Lógica para mostrar error
  const shouldShowError = useMemo(
    () => hasError && sessionId === currentSessionRef.current && !isLoading,
    [hasError, sessionId, isLoading]
  );

  const shouldShowThinking = useMemo(
    () =>
      finalIsThinking &&
      finalThinkingContent &&
      sessionId === currentSessionRef.current,
    [finalIsThinking, finalThinkingContent, sessionId]
  );

  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, sessionId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={onScroll}
    >
      <div className="px-2 sm:px-4 pb-24 sm:pb-36 pt-8 sm:pt-16">
        {isLoadingMore && <LoadingMoreMessages />}

        {allMessagesLoaded && messages.length > 0 && !isLoadingMore && (
          <div className="sticky top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm">
            <AllMessagesLoaded />
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.id}-${index}-${
              message.isOptimistic ? "opt" : "reg"
            }`}
            // className="mb-4 sm:mb-8"
            className={`mb-8 ${index === 0 ? 'mt-8' : ''}`} // Agregar margen superior al primer mensaje 
          >
            <MessageItem
              message={message}
              index={index}
              isMobile={isMobile}
              isEditorOpen={isEditorOpen}
              isCollapsed={isCollapsed}
              supabase={supabase}
              calculateCorrectVersionId={calculateCorrectVersionId}
              handleRetry={handleRetry}
              setCurrentMessage={setCurrentMessage}
              setIsEditorOpen={setIsEditorOpen}
              setIsEditorExpanded={setIsEditorExpanded}
              isThinkingComplete={isThinkingComplete}
              editingMessageId={editingMessageId}
              editedContent={editedContent}
              isEditLoading={isEditLoading}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              setEditedContent={setEditedContent}
            />
          </div>
        ))}

        {/* ✅ NUEVO: Mostrar error en lugar de loading cuando hay error */}
        {shouldShowError && (
          <div
            className={`flex justify-start ${
              isCollapsed && !isMobile ? "pl-14" : "pl-0"
            } border-border w-full`}
          >
            <div
              className={`${isEditorOpen && !isMobile ? "w-[90%]" : "w-full"}`}
            >
              <div className="mb-8 sm:mb-16">
                <PredictiveError
                  errorMessage={errorMessage || "Error al enviar mensaje"}
                  onRetry={onRetryError}
                />
              </div>
            </div>
          </div>
        )}

        {/* ✅ MEJORADO: Solo mostrar loading si no hay error */}
        {shouldShowLoading && !shouldShowError && (
          <div
            className={`flex justify-start ${
              isCollapsed && !isMobile ? "pl-14" : "pl-0"
            } border-border w-full`}
          >
            <div
              className={`${isEditorOpen && !isMobile ? "w-[90%]" : "w-full"}`}
            >
              <div className="mb-8 sm:mb-16">
                <PredictiveLoading
                  isLoading={true}
                  isThinking={
                    isReasoningActive ||
                    finalIsThinking ||
                    !!finalThinkingContent
                  }
                />
              </div>

              {shouldShowThinking && (
                <div className="mb-6 sm:mb-10">
                  <ThinkingDisplay
                    content={finalThinkingContent}
                    isVisible={finalIsThinking}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageList;
