"use client";

import type React from "react";
import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X, Bot } from "lucide-react";
import { PredictiveDragDrop } from "./PredictiveDragDrop";
import { PredictiveFileUpload } from "./PredictiveFileUpload";
import type { Attachment } from "./PredictiveTypes";
import clsx from "clsx";
import { useTheme } from "@/context/ThemeContext";

interface PredictiveInputProps {
  input: string;
  setInput: (value: string) => void;
  attachments: Attachment[];
  removeAttachment: (index: number) => void;
  handleSend: (
    messageContent?: string,
    messageAttachments?: Attachment[]
  ) => void;
  handleFileUpload: (file: File) => void;
  isLoading: boolean;
  isGenerating: boolean;
  stopGenerating: () => void;
  uploadedFilesCount: number;
  project_id: string;
  session_id: string;
  isCollapsed: boolean;
  version_id: number;
  aiButtonsState?: {
    reasoning: boolean;
    search: boolean;
    document: boolean;
    agentic: boolean;
  };
  onButtonStateChange?: (state: {
    reasoning: boolean;
    search: boolean;
    document: boolean;
    agentic: boolean;
  }) => void;
}

const AttachmentsList = memo(
  ({
    attachments,
    removeAttachment,
    theme,
  }: {
    attachments: Attachment[];
    removeAttachment: (index: number) => void;
    theme: string;
  }) => {
    if (attachments.length === 0) return null;

    return (
      <div className="mb-3 flex flex-wrap gap-2">
        {attachments.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className={clsx(
              "flex items-center gap-1 rounded-full px-3 sm:px-4 py-1 text-xs sm:text-sm text-foreground",
              theme === "dark" ? "bg-card" : "bg-muted",
              file.uploading && "border border-yellow-500 animate-pulse",
              file.uploaded === true && "border border-green-500",
              file.uploaded === false && "border border-red-500"
            )}
          >
            <span className="truncate max-w-[100px] sm:max-w-[150px]">
              {file.name}
            </span>
            {file.uploading && (
              <span className="text-xs text-yellow-500 animate-pulse">
                Subiendo...
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 sm:h-5 sm:w-5 p-0 hover:bg-accent rounded-full"
              onClick={() => removeAttachment(index)}
            >
              <X className="h-2 w-2 sm:h-3 sm:w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  }
);

AttachmentsList.displayName = "AttachmentsList";

// Función helper para obtener las clases del botón con debugging
const getButtonClasses = (isActive: boolean, buttonName: string) => {
  const baseClasses =
    "h-6 sm:h-8 px-2 sm:px-3 rounded-xl flex items-center gap-1 text-xs sm:text-sm transition-all duration-200";

  // Debug log para verificar el estado
  console.log(`PredictiveInput ${buttonName} isActive: ${isActive}`);

  if (isActive) {
    return `${baseClasses} !bg-quaternary !text-white shadow-md border-2 border-quaternary`;
  }

  return `${baseClasses} bg-background text-foreground hover:bg-muted border-2 border-transparent`;
};

const ActionButtons = memo(
  ({
    activeButtons,
    toggleButton,
    isMobile,
  }: {
    activeButtons: {
      reasoning: boolean;
      search: boolean;
      document: boolean;
      agentic: boolean;
    };
    toggleButton: (
      button: "reasoning" | "search" | "document" | "agentic"
    ) => void;
    isMobile: boolean;
  }) => (
    <div
      className={`flex items-center gap-1 sm:gap-2 ${
        isMobile ? "flex-wrap" : ""
      }`}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleButton("reasoning")}
        className={getButtonClasses(activeButtons.reasoning, "reasoning")}
        data-active={activeButtons.reasoning}
      >
        <span role="img" aria-label="brain" className="text-xs sm:text-sm">
          🧠
        </span>
        {!isMobile && <span className="hidden sm:inline">Reasoning</span>}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleButton("search")}
        className={getButtonClasses(activeButtons.search, "search")}
        data-active={activeButtons.search}
      >
        <span role="img" aria-label="world" className="text-xs sm:text-sm">
          🌎
        </span>
        {!isMobile && <span className="hidden sm:inline">Search</span>}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleButton("document")}
        className={getButtonClasses(activeButtons.document, "document")}
        data-active={activeButtons.document}
      >
        <span role="img" aria-label="document" className="text-xs sm:text-sm">
          📄
        </span>
        {!isMobile && <span className="hidden sm:inline">Document</span>}
      </Button>

      {/* Solo mostrar el botón Agentic en desktop (no móvil) */}
      {!isMobile && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleButton("agentic")}
          className={clsx(
            "h-6 sm:h-8 px-2 sm:px-3 rounded-xl flex items-center gap-1 text-xs sm:text-sm",
            activeButtons.agentic
              ? "bg-quaternary text-white"
              : "bg-background text-foreground"
          )}
        >
          <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Agentic</span>
        </Button>
      )}
    </div>
  )
);

ActionButtons.displayName = "ActionButtons";

export const PredictiveInput = memo(function PredictiveInput({
  input,
  setInput,
  attachments,
  removeAttachment,
  handleSend,
  handleFileUpload,
  isLoading,
  isGenerating,
  stopGenerating,
  project_id,
  session_id,
  version_id,
  isCollapsed,
  aiButtonsState,
  onButtonStateChange,
}: PredictiveInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { theme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasPendingOrErroredAttachments = attachments.some(
    (att) => att.uploading || att.uploaded === false
  );

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const activeButtons = aiButtonsState || {
    reasoning: false,
    search: false,
    document: false,
    agentic: false,
  };

  useEffect(() => {
    console.log("🔘 PredictiveInput - Estado de botones:", {
      aiButtonsState,
      activeButtons,
      onButtonStateChange: !!onButtonStateChange,
    });
  }, [aiButtonsState, activeButtons, onButtonStateChange]);

  useEffect(() => {
    if (aiButtonsState) {
      console.log(
        "🔄 PredictiveInput - Sincronizando estado visual:",
        aiButtonsState
      );
    }
  }, [aiButtonsState]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(
        textarea.scrollHeight,
        isMobile ? 120 : 200
      )}px`;
    }
  }, [isMobile]);

  useEffect(() => {
    const timeoutId = setTimeout(adjustTextareaHeight, 0);
    return () => clearTimeout(timeoutId);
  }, [input, adjustTextareaHeight]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      try {
        await Promise.all(
          Array.from(e.dataTransfer.files).map((file) => handleFileUpload(file))
        );
      } catch (error) {
        console.error("Error al cargar archivos:", error);
      }
    },
    [handleFileUpload]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleFileUpload(file);
          }
          break;
        }
      }
    },
    [handleFileUpload]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (typeof window !== "undefined") {
          (window as any).__currentButtonState = activeButtons;
        }
        handleSend(input, attachments);
      }
    },
    [handleSend, input, attachments, activeButtons]
  );

  const handleSendClick = useCallback(() => {
    if (typeof handleSend === "function") {
      const sendWithButtonState = () => {
        if (typeof window !== "undefined") {
          (window as any).__currentButtonState = activeButtons;
        }
        handleSend(input, attachments);
      };
      sendWithButtonState();
    }
  }, [handleSend, input, attachments, activeButtons]);

  const toggleButton = useCallback(
    (button: "reasoning" | "search" | "document" | "agentic") => {
      if (!onButtonStateChange) {
        console.warn("⚠️ onButtonStateChange no está disponible");
        return;
      }

      // Usar función de callback para asegurar estado actual
      const newState = { ...activeButtons, [button]: !activeButtons[button] };

      console.log("🔘 PredictiveInput toggleButton:", {
        button,
        oldState: activeButtons,
        newState,
      });

      // Llamar a la función parent
      onButtonStateChange(newState);

      // Forzar re-render adicional si es necesario
      setTimeout(() => {
        onButtonStateChange({ ...newState });
      }, 0);
    },
    [activeButtons, onButtonStateChange]
  );

  return (
    <div
      className={`fixed bottom-0 ${theme} bg-background transition-all duration-300 ${
        isMobile
          ? "left-0 right-0"
          : isCollapsed
          ? "left-14 right-14"
          : "left-64 right-14"
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <PredictiveDragDrop isDragging={isDragging} />

      <div className="max-w-[100%] mx-auto px-3 sm:px-6 pb-4 sm:pb-6 pt-1">
        <AttachmentsList
          attachments={attachments}
          removeAttachment={removeAttachment}
          theme={theme}
        />

        <div
          className={`relative flex flex-col ${
            theme === "dark"
              ? "bg-card text-white"
              : "bg-muted text-black hover:bg-muted/80"
          } rounded-lg px-2 sm:px-3 py-2 transition-all duration-200`}
        >
          <div className="w-full mb-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Escribe tu mensaje..."
              className="min-h-[50px] sm:min-h-[60px] w-full bg-transparent border-0 focus-visible:ring-0 resize-none text-sm px-2 sm:px-3 py-2 text-foreground placeholder:text-muted-foreground overflow-hidden"
              style={{
                maxHeight: isMobile ? "120px" : "200px",
                overflowY: "auto",
              }}
            />
          </div>

          <div className={`flex w-full pb-1 items-center justify-between`}>
            <div className="flex items-center gap-1">
              <ActionButtons
                activeButtons={activeButtons}
                toggleButton={toggleButton}
                isMobile={isMobile}
              />
            </div>

            <div className="flex items-center gap-2">
              <PredictiveFileUpload
                onFileUpload={handleFileUpload}
                currentUploadCount={attachments.length}
                disabled={isLoading}
              />
              <Button
                variant="default"
                size="icon"
                onClick={handleSendClick}
                disabled={
                  isLoading ||
                  hasPendingOrErroredAttachments ||
                  (!input.trim() && attachments.length === 0)
                }
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-quaternary hover:bg-quaternary text-white disabled:opacity-50"
              >
                {isGenerating ? (
                  <X
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    onClick={stopGenerating}
                  />
                ) : (
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center"></div>
      )}
    </div>
  );
});

export default PredictiveInput;
