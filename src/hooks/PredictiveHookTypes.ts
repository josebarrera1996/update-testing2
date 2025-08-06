import type React from "react";
import type {
  Message,
  Attachment,
} from "@/components/predictive/PredictiveTypes";

// Interfaces para los hooks
export interface AIButtonsState {
  reasoning: boolean;
  search: boolean;
  document: boolean;
  agentic: boolean;
}

// Parámetros para usePredictiveMessages
export interface UsePredictiveMessagesParams {
  initialMessages: Message[];
  sessionId: string | null;
  onUpdateMessages?: (sessionId: string, messages: Message[]) => Promise<void>;
}

// Retorno de usePredictiveMessages
export interface UsePredictiveMessagesReturn {
  messages: Message[];
  visibleMessages: Message[];
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  allMessagesLoaded: boolean;
  loadMoreMessages: (scrollContainer?: HTMLElement | null) => void;
  restoreScrollPosition: (scrollContainer: HTMLElement | null) => void;
  calculateCorrectVersionId: (message: Message) => number;
  calculateNextVersion: (messages: Message[]) => number;
  updateMessages: (newMessages: Message[]) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoading: boolean;
  pendingMessage: Message | null;
  startLoading: (pendingMessage: Message) => void;
  stopLoading: () => void;
  loadMessagesFromDB: () => Promise<void>;
}

// Parámetros para usePredictiveFiles
export interface UsePredictiveFilesParams {
  userId?: string;
  sessionId?: string | null;
}

// Retorno de usePredictiveFiles
export interface UsePredictiveFilesReturn {
  attachments: Attachment[];
  isDragging: boolean;
  handleFileUpload: (file: File) => Promise<Attachment | undefined>;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
}

// Parámetros para usePredictiveSend
export interface UsePredictiveSendParams {
  sessionId: string | null;
  projectId: string;
  updateMessages: (newMessages: Message[]) => void;
  messages: Message[];
  clearAttachments: () => void;
  onNewChat: () => Promise<string | null>;
  onChatNameUpdate?: (sessionId: string, name: string) => Promise<void> | void;
  calculateNextVersion: (messages: Message[]) => number;
  attachments?: Attachment[];
  thinkingSession?: {
    sessionId: string;
    versionId: number;
  } | null;
  isThinkingFromWelcome?: boolean;
  onUserSentMessage?: () => void;
}

// Retorno de usePredictiveSend
export interface UsePredictiveSendReturn {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  aiButtonsState: AIButtonsState;
  handleButtonStateChange: (state: AIButtonsState) => void;
  handleSend: (
    messageContent?: string | React.MouseEvent,
    messageAttachments?: Attachment[]
  ) => Promise<void>;
  lastOptimisticMessage: Message | null;
}

// Parámetros para usePredictive
export interface UsePredictiveParams {
  initialMessages: Message[];
  sessionId: string | null;
  projectId: string;
  userId?: string;
  onUpdateMessages?: (sessionId: string, messages: Message[]) => Promise<void>;
  onNewChat: () => Promise<string | null>;
  onChatNameUpdate?: (sessionId: string, name: string) => Promise<void> | void;
  thinkingSession?: {
    sessionId: string;
    versionId: number;
  } | null;
  isThinkingFromWelcome?: boolean;
  initialAiButtonsState?: AIButtonsState;
  externalThinkingContent?: string;
  externalIsThinking?: boolean;
  externalIsThinkingComplete?: boolean;
  onUserSentMessage?: () => void;
  activeSessionRef?: React.MutableRefObject<string | null>;
  startWatching?: () => void; // Función para iniciar la observación de cambios
  stopWatching?: () => void; // Función para detener la observación de cambios
  handleSendError?: (error: Error, sessionId: string, message: Message) => void; // Función para manejar errores al enviar mensajes
}

// Retorno de usePredictive
export interface UsePredictiveReturn {
  messages: Message[];
  visibleMessages: Message[];
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  allMessagesLoaded: boolean;
  loadMoreMessages: (scrollContainer?: HTMLElement | null) => void;
  restoreScrollPosition: (scrollContainer: HTMLElement | null) => void;
  calculateCorrectVersionId: (message: Message) => number;

  attachments: Attachment[];
  isDragging: boolean;
  handleFileUpload: (file: File) => Promise<Attachment | undefined>;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  removeAttachment: (index: number) => void;

  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  aiButtonsState: AIButtonsState;
  handleButtonStateChange: (state: AIButtonsState) => void;
  handleSend: (
    messageContent?: string | React.MouseEvent,
    messageAttachments?: Attachment[]
  ) => Promise<void>;
  handleRetry: (
    messageContent: string,
    messageAttachments?: Attachment[]
  ) => void;
  lastOptimisticMessage: Message | null;
  thinkingContent: string;
  isThinking: boolean;
  isThinkingComplete: boolean;
  finishThinking: () => void;
  isReasoningActive: boolean | undefined;
  savedThinkingContent: string;
  editingMessageId: string | null;
  editedContent: string;
  isEditLoading: boolean;
  setEditedContent: React.Dispatch<React.SetStateAction<string>>;
  startEdit: (messageId: string, currentContent: string) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  isEditing: boolean;
}
