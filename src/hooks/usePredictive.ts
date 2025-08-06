"use client";

import type React from "react";

import { useCallback } from "react";
import { usePredictiveMessages } from "./usePredictiveMessages";
import { usePredictiveFiles } from "./usePredictiveFiles";
import { usePredictiveSend } from "./usePredictiveSend";
import type {
  UsePredictiveParams,
  UsePredictiveReturn,
} from "./PredictiveHookTypes";
import type { Attachment } from "@/components/predictive/PredictiveTypes";
import { usePredictiveEdit } from "./usePredictiveEdit";

export function usePredictive({
  initialMessages,
  sessionId,
  projectId,
  userId,
  onUpdateMessages,
  onNewChat,
  onChatNameUpdate,
  thinkingSession,
  isThinkingFromWelcome,
  startWatching, // ✅ Ahora parte de UsePredictiveParams
  stopWatching, // ✅ Ahora parte de UsePredictiveParams
  handleSendError, // ✅ Ahora parte de UsePredictiveParams
  activeSessionRef,
  initialAiButtonsState,
  externalThinkingContent,
  externalIsThinking,
  externalIsThinkingComplete,
  onUserSentMessage,
}: UsePredictiveParams): UsePredictiveReturn {
  const {
    messages,
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
  } = usePredictiveMessages({
    initialMessages,
    sessionId,
    onUpdateMessages,
  });

  const {
    attachments,
    isDragging,
    handleFileUpload,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    removeAttachment,
    clearAttachments,
  } = usePredictiveFiles({
    userId,
    sessionId,
  });

  const {
    attachments: messageAttachments,
    isDragging: messageIsDragging,
    handleFileUpload: handleMessageFileUpload,
    handleDragEnter: handleMessageDragEnter,
    handleDragLeave: handleMessageDragLeave,
    handleDrop: handleMessageDrop,
    removeAttachment: removeMessageAttachment,
    clearAttachments: clearMessageAttachments,
  } = usePredictiveFiles({
    userId,
    sessionId,
  });

  const {
    input,
    setInput,
    isLoading,
    aiButtonsState,
    handleButtonStateChange,
    handleSend: originalHandleSend,
    lastOptimisticMessage,
    thinkingContent,
    isThinking,
    isThinkingComplete,
    finishThinking,
    isReasoningActive,
    savedThinkingContent,
  } = usePredictiveSend({
    sessionId,
    projectId,
    updateMessages,
    messages,
    clearAttachments: clearMessageAttachments,
    onNewChat,
    onChatNameUpdate,
    calculateNextVersion,
    attachments: messageAttachments,
    thinkingSession,
    isThinkingFromWelcome,
    startLoadingWatch: startWatching, // ✅ Pasar directamente
    stopLoadingWatch: stopWatching, // ✅ Pasar directamente
    handleSendError: handleSendError
      ? (sessionId: string, errorMessage: string, failedMessage: any) =>
          Promise.resolve(
            handleSendError(new Error(errorMessage), sessionId, failedMessage)
          )
      : undefined, // Adapt to expected signature
  });

  const handleSend = useCallback(
    (
      messageContent?: string | React.MouseEvent,
      explicitAttachments?: Attachment[]
    ) => {
      const attachmentsToUse = explicitAttachments || attachments;
      return originalHandleSend(messageContent, attachmentsToUse);
    },
    [attachments, originalHandleSend]
  );

  const {
    editingMessageId,
    editedContent,
    isEditLoading,
    setEditedContent,
    startEdit,
    cancelEdit,
    saveEdit,
    isEditing,
  } = usePredictiveEdit({
    handleSend,
    messages,
    updateMessages,
  });

  const handleRetry = useCallback(
    (messageContent: string, messageAttachments?: Attachment[]) => {
      handleSend(messageContent, messageAttachments);
    },
    [handleSend]
  );

  return {
    // Estado de mensajes
    messages,
    visibleMessages,
    hasMoreMessages,
    isLoadingMore,
    allMessagesLoaded,
    loadMoreMessages,
    restoreScrollPosition,
    calculateCorrectVersionId,

    // Estado de archivos
    attachments: messageAttachments,
    isDragging: messageIsDragging,
    handleFileUpload: handleMessageFileUpload,
    handleDragEnter: handleMessageDragEnter,
    handleDragLeave: handleMessageDragLeave,
    handleDrop: handleMessageDrop,
    removeAttachment: removeMessageAttachment,

    // Estado de envío
    input,
    setInput,
    isLoading,
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

    // Estado de edición
    editingMessageId,
    editedContent,
    isEditLoading,
    setEditedContent,
    startEdit,
    cancelEdit,
    saveEdit,
    isEditing,
  };
}
