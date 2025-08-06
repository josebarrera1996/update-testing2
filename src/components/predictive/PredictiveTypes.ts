import type { User as SupabaseUser } from "@supabase/supabase-js"

// Tipos esenciales
export interface Attachment {
  name: string
  url: string
  type: string
  file?: File
  bucketPath?: string
  content?: number[]
  uploaded?: boolean
  fileKey?: string
  uploading?: boolean
}

export type User = SupabaseUser & {
  user_metadata: {
    role?: string | null
    // Añade otros campos de metadatos si es necesario
  }
}

export interface PredictiveError extends Error {
  code?: string
  details?: unknown
}

export interface N8NError {
  message: string
  status?: number
  details?: unknown
}

export interface Prediction {
  confidence: number
  data?: {
    explicación?: string
    codigo?: string
    código_output?: string
  }
  metrics?: {
    accuracy?: number
    precision?: number
    recall?: number
  }
  visualization?: string
}

export interface MessageContent {
  type: "human" | "ai"
  content: string
  additional_kwargs: Record<string, any>
  response_metadata: Record<string, any>
  tool_calls?: any[]
  invalid_tool_calls?: any[]
}

export interface Chat {
  id: string
  session_id: string
  project_id: string
  version_id: number
  user_id: string
  name: string
  messages: Message[]
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  error?: boolean
  errorMessage?: string
  attachments?: Attachment[]
  prediction?: Prediction
  project_id: string
  session_id: string
  version_id: number
  isOptimistic?: boolean
  thinking: boolean
  isFirstMessage: boolean
  optimisticId?: string
}

export interface PredictiveAnalyticsProps {
  session_id: string | null
  messages: Message[]
  onUpdateMessages: (session_id: string, messages: Message[]) => Promise<void>
  onNewChat: () => Promise<string | null>
  onChatNameUpdate?: (session_id: string, chatName: string) => Promise<void> | void
  isCollapsed: boolean
  project_id: string
  version_id: number
  className?: string
  thinkingSession?: {
    sessionId: string
    versionId: number
  } | null
  isThinkingFromWelcome?: boolean
  setHandleSendRef?: (ref: (messageContentParam: string, messageAttachments?: Attachment[]) => Promise<void>) => void
}

export interface PredictiveInputProps {
  input: string
  setInput: (value: string) => void
  attachments: Attachment[]
  removeAttachment: (index: number) => void
  handleSend: () => Promise<void>
  handleFileUpload: (file: File) => void
  isLoading: boolean
  isGenerating?: boolean
  stopGenerating?: () => void
  uploadedFilesCount: number
  isCollapsed: boolean
  handleCameraCapture: (file: File) => void
  onTranscriptionComplete?: (text: string) => void
  project_id: string
  session_id: string
  version_id: number
}

export interface PredictiveResponseProps {
  content: string
  timestamp?: string
  prediction?: Prediction
  project_id: string
  session_id: string
  version_id: number
}

export interface PredictiveUserProps {
  content: string
  timestamp?: string
  attachments?: Attachment[]
  onEdit?: () => void
  onRetry?: () => void
  error?: boolean
  errorMessage?: string
  project_id: string
  session_id: string
  version_id: number
  isOptimistic?: boolean
}

// Tipos para los agentes
export interface AgentInput {
  project_id: string
  session_id: string
  version_id: number
  input: Record<string, any>
}

export interface AgentOutput {
  project_id: string
  session_id: string
  version_id: number
  output: Record<string, any>
}

interface Version {
  id: string
  version_id: number
  created_at: string
  output: any
  url_attachment?: string
  user_id: string
  project_id: string
  session_id: string
}

export type StoragePublicUrlResponse = {
  data: {
    publicUrl: string
  }
}

export interface AgentResearch extends AgentInput, AgentOutput {}
export interface AgentProgramming extends AgentInput, AgentOutput {}
export interface AgentDocumentation extends AgentInput, AgentOutput {}
