"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Paperclip, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@supabase/supabase-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/context/ThemeContext";
import { createClient } from "@/lib/supabase-client";
import clsx from "clsx";
import type { Attachment, Message } from "./PredictiveTypes";
import { ThinkingDisplay } from "./ThinkingDisplay";
import { usePredictiveFiles } from "@/hooks/usePredictiveFiles";

interface StudioWelcomeProps {
  onSendMessage: (
    message: string,
    role?: string | undefined,
    attachments?: Attachment[] | undefined,
    aiButtonsState?: {
      reasoning: boolean;
      search: boolean;
      document: boolean;
      agentic: boolean;
    }
  ) => Promise<void>;
  user: User | null;
  currentRole?: string | null;
  onRoleChange?: (role: string) => Promise<void>;
  thinkingContent?: string;
  isThinking?: boolean;
  isThinkingComplete?: boolean;
  pendingChatName?: string | null;
}

export function StudioWelcome({
  onSendMessage,
  user,
  currentRole,
  onRoleChange,
  thinkingContent = "",
  isThinking = false,
  isThinkingComplete = false,
  pendingChatName,
}: StudioWelcomeProps) {
  const [input, setInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [activeButtons, setActiveButtons] = useState({
    reasoning: false,
    search: false,
    document: false,
    agentic: false,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const supabase = createClient();
  const [suggestedPrompts, setSuggestedPrompts] = useState<
    { title: string; description: string; prompt: string }[]
  >([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
    userId: user?.id,
    sessionId: "welcome",
  });

  const hasPendingOrErroredAttachments = attachments.some(
    (att) => att.uploading || att.uploaded === false
  );

  // Fetch available roles from the database
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("hestia_roles")
          .select("role");

        if (error) {
          console.error("Error fetching roles:", error);
          return;
        }

        if (data) {
          const roleList = data.map((item) => item.role).filter(Boolean);
          setRoles(roleList);
        }
      } catch (error) {
        console.error("Error in fetchRoles:", error);
      }
    };

    fetchRoles();
  }, [supabase]);

  // Set the selected role when currentRole changes
  useEffect(() => {
    if (currentRole) {
      setSelectedRole(currentRole);
    }
  }, [currentRole]);

  //Handle prompt suggestion selection
  useEffect(() => {
    if (!user?.id) return;

    const fetchSuggestedPrompts = async () => {
      setIsLoadingPrompts(true);
      const { data, error } = await supabase
        .from("hestia_suggested_prompts")
        .select("prompts")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching suggested prompts:", error);
        setSuggestedPrompts([]);
      } else if (data && Array.isArray(data.prompts)) {
        setSuggestedPrompts(data.prompts);
      } else {
        setSuggestedPrompts([]);
      }
      setIsLoadingPrompts(false);
    };

    fetchSuggestedPrompts();
  }, [user?.id, supabase]);

  // Adjust textarea height as content changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(
        textarea.scrollHeight,
        isMobile ? 150 : 200
      )}px`;
    }
  }, [input, isMobile]);

  function getWelcomeMessage(user: User | null) {
    const hour = new Date().getHours();
    let greeting = "Buenos días";

    if (hour >= 6 && hour < 13) greeting = "Buenos días";
    else if (hour >= 13 && hour < 19) greeting = "Buenas tardes";
    else greeting = "Buenas noches";

    const fullName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "Usuario";
    const firstName = fullName.split(" ")[0];

    return `${greeting}, ${firstName}`;
  }

  const toggleButton = (
    button: "reasoning" | "search" | "document" | "agentic"
  ) => {
    // Forzar el re-render usando una función de callback
    setActiveButtons((prevState) => {
      const newState = {
        ...prevState,
        [button]: !prevState[button],
      };

      // Log después de calcular el nuevo estado
      console.log(`Welcome: Botón ${button} cambiado a: ${newState[button]}`);

      return newState;
    });

    // Forzar una actualización adicional para asegurar el re-render
    setTimeout(() => {
      setActiveButtons((prevState) => ({ ...prevState }));
    }, 0);
  };

  // Función helper para obtener las clases del botón con debugging (FUNCIÓN NUEVA)
  const getButtonClasses = (isActive: boolean, buttonName: string) => {
    const baseClasses =
      "h-7 sm:h-8 px-2 sm:px-3 rounded-md flex items-center gap-1 text-xs sm:text-sm transition-all duration-200";

    // Debug log para verificar el estado
    console.log(`${buttonName} isActive: ${isActive}`);

    if (isActive) {
      return `${baseClasses} !bg-quaternary !text-white shadow-md border-2 border-quaternary`;
    }

    return `${baseClasses} bg-background text-foreground hover:bg-muted border-2 border-transparent`;
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    setIsLoading(true);
    try {
      console.log("🚀 Welcome: Enviando mensaje con flujo simplificado...");
      console.log("🔍 Welcome: Estados de botones actuales:", activeButtons);

      const optimisticMessage: Message = {
        id: `welcome-optimistic-${Date.now()}-${Math.random()}`,
        role: "user",
        content: input.trim(),
        timestamp: new Date().toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined,
        project_id: crypto.randomUUID(),
        session_id: "welcome-temp",
        version_id: 0,
        thinking: false,
        isOptimistic: true,
        isFirstMessage: true,
      };

      console.log(
        "✅ Welcome: Mensaje optimista creado:",
        optimisticMessage.id
      );

      if (typeof window !== "undefined") {
        (window as any).__welcomeOptimisticMessage = optimisticMessage;
        (window as any).__welcomeAiButtonsState = activeButtons;
        console.log("💾 Welcome: Estados guardados en window para page.tsx");
      }

      await onSendMessage(
        input,
        selectedRole || undefined,
        attachments,
        activeButtons
      );

      setInput("");
      clearAttachments();

      console.log("✅ Welcome: Mensaje enviado exitosamente");
    } catch (error) {
      console.error("❌ Welcome: Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRoleChange = async (newRole: string) => {
    setSelectedRole(newRole);

    if (onRoleChange) {
      try {
        await onRoleChange(newRole);
      } catch (error) {
        console.error("Error changing role:", error);
      }
    }
  };

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        try {
          await Promise.all(
            Array.from(e.target.files).map((file) => handleFileUpload(file))
          );
        } catch (error) {
          console.error("Error al cargar archivos:", error);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [handleFileUpload]
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
  };

  const titleVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
      },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delay: 0.3,
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <div
      className="flex flex-col items-center justify-start h-screen overflow-y-auto px-3 sm:px-4 py-8 sm:py-12"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="p-4 sm:p-6 bg-card rounded-lg border-2 border-dashed border-primary flex flex-col items-center max-w-sm w-full">
            <div className="mb-2 p-2 sm:p-3 bg-primary/10 rounded-full">
              <Paperclip className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <p className="text-base sm:text-lg font-medium text-center">
              Suelta los archivos aquí
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Archivos permitidos: imágenes, PDF, documentos, CSV, Excel
            </p>
          </div>
        </div>
      )}

      <motion.div
        className="flex flex-col items-center max-w-3xl w-full"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.2,
            },
          },
        }}
      >
        <motion.h1
          className={`${
            isMobile ? "text-3xl" : "text-5xl"
          } font-bold mb-6 sm:mb-8 text-center px-2 mt-6 sm:mt-8`}
          variants={titleVariants}
          initial="hidden"
          animate="visible"
          style={{
            background: "linear-gradient(to right, #8a2be2, #954ce9, #a370f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 8px rgba(149, 76, 233, 0.3)",
          }}
          whileInView={{
            textShadow: [
              "0 0 8px rgba(149, 76, 233, 0.3)",
              "0 0 15px rgba(149, 76, 233, 0.7)",
              "0 0 8px rgba(149, 76, 233, 0.3)",
            ],
            transition: {
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "reverse",
            },
          }}
        >
          {getWelcomeMessage(user)}
        </motion.h1>

        <motion.div
          className="w-full mb-4 sm:mb-6"
          variants={containerVariants}
        >
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger
              className={`w-full ${
                theme === "dark" ? "bg-card" : "bg-muted"
              } border-0`}
            >
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {selectedRole === role ? `Rol elegido: ${role}` : role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {attachments.length > 0 && (
          <motion.div
            className="w-full mb-3 flex flex-wrap gap-2"
            variants={containerVariants}
          >
            {attachments.map((file, index) => (
              <div
                key={index}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-foreground",
                  theme === "dark" ? "bg-card" : "bg-muted",
                  file.uploading && "border border-yellow-500 animate-pulse",
                  file.uploaded === true && "border border-green-500",
                  file.uploaded === false && "border border-red-500"
                )}
              >
                <span className="truncate max-w-[120px] sm:max-w-[150px]">
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
          </motion.div>
        )}

        <motion.div
          className={`relative w-full rounded-lg ${
            theme === "dark" ? "bg-card" : "bg-muted"
          }`}
          variants={containerVariants}
          style={{
            boxShadow:
              theme === "dark"
                ? "0 0 15px rgba(149, 76, 233, 0.3)"
                : "0 0 20px rgba(149, 76, 233, 0.4)",
          }}
        >
          <div className="flex flex-col p-3 sm:p-4">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="¿En qué puedo ayudarte hoy?"
              className={`welcome-textarea ${
                isMobile ? "min-h-[100px]" : "min-h-[120px]"
              } w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none ${
                isMobile ? "text-base" : "text-lg"
              } px-2 sm:px-3 py-2 text-foreground placeholder:text-muted-foreground`}
              style={{
                maxHeight: isMobile ? "150px" : "300px",
                overflowY: "auto",
              }}
            />

            <div
              className={`flex mt-2 ${
                isMobile
                  ? "flex-row justify-between items-center"
                  : "justify-between items-center"
              }`}
            >
              <div
                className={`flex items-center gap-1 sm:gap-2 ${
                  isMobile ? "" : ""
                }`}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleButton("reasoning")}
                  className={getButtonClasses(
                    activeButtons.reasoning,
                    "reasoning"
                  )}
                  data-active={activeButtons.reasoning}
                >
                  <span
                    role="img"
                    aria-label="brain"
                    className="text-xs sm:text-sm"
                  >
                    🧠
                  </span>
                  <span className={isMobile ? "text-xs" : ""}>Reasoning</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleButton("search")}
                  className={getButtonClasses(activeButtons.search, "search")}
                  data-active={activeButtons.search}
                >
                  <span
                    role="img"
                    aria-label="world"
                    className="text-xs sm:text-sm"
                  >
                    🌎
                  </span>
                  <span className={isMobile ? "text-xs" : ""}>Search</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleButton("document")}
                  className={getButtonClasses(
                    activeButtons.document,
                    "document"
                  )}
                  data-active={activeButtons.document}
                >
                  <span
                    role="img"
                    aria-label="document"
                    className="text-xs sm:text-sm"
                  >
                    📄
                  </span>
                  <span className={isMobile ? "text-xs" : ""}>Document</span>
                </Button>

                {/* Solo mostrar el botón Agentic en desktop (no móvil) */}
                {!isMobile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleButton("agentic")}
                    className={clsx(
                      "h-7 sm:h-8 px-2 sm:px-3 rounded-md flex items-center gap-1 text-xs sm:text-sm",
                      activeButtons.agentic
                        ? "bg-quaternary text-white"
                        : "bg-background text-foreground"
                    )}
                  >
                    <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className={isMobile ? "text-xs" : ""}>Agentic</span>
                  </Button>
                )}
              </div>

              <div className={`flex items-center gap-1 ${isMobile ? "" : ""}`}>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileInputChange}
                    multiple
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </Button>
                </div>

                <Button
                  variant="default"
                  onClick={handleSend}
                  disabled={
                    isLoading ||
                    hasPendingOrErroredAttachments ||
                    (!input.trim() && attachments.length === 0)
                  }
                  className="h-9 px-3 sm:h-10 sm:px-4 rounded-full bg-quaternary hover:bg-quaternary/90 text-white"
                >
                  {isLoading ? (
                    <div className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {isThinking && thinkingContent && (
          <motion.div
            className="w-full mt-4 sm:mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ThinkingDisplay content={thinkingContent} isVisible={isThinking} />
          </motion.div>
        )}

        <motion.div
          className="mt-6 sm:mt-8 w-full"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { delay: 0.6, duration: 0.5 },
            },
          }}
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            <span
              className={`${
                isMobile ? "text-base" : "text-lg"
              } font-semibold text-center`}
            >
              Prompts sugeridos por HestIA
            </span>
            <span className="text-xl" role="img" aria-label="sparkles">
              ✨
            </span>
          </div>

          <div
            className={`grid ${
              isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
            } gap-3 sm:gap-4`}
          >
            {isLoadingPrompts ? (
              <div className="col-span-2 text-center text-muted-foreground py-6 sm:py-8">
                Cargando sugerencias...
              </div>
            ) : suggestedPrompts.length > 0 ? (
              suggestedPrompts.map(({ title, description, prompt }, idx) => (
                <SuggestionCard
                  key={idx}
                  title={title}
                  description={description}
                  onClick={() => {
                    setInput(prompt);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                  isMobile={isMobile}
                />
              ))
            ) : (
              <div className="col-span-2 text-center text-muted-foreground py-6 sm:py-8">
                No se pudieron cargar prompts sugeridos para tu usuario.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

interface SuggestionCardProps {
  title: string;
  description: string;
  onClick: () => void;
  isMobile?: boolean;
}

function SuggestionCard({
  title,
  description,
  onClick,
  isMobile = false,
}: SuggestionCardProps) {
  const { theme } = useTheme();

  return (
    <motion.div
      className={`p-3 sm:p-4 rounded-lg cursor-pointer ${
        theme === "dark"
          ? "bg-card hover:bg-card/80"
          : "bg-muted hover:bg-muted/80"
      } transition-colors duration-200`}
      onClick={onClick}
      whileHover={{ scale: isMobile ? 1.01 : 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <h3 className={`font-medium mb-1 ${isMobile ? "text-sm" : "text-base"}`}>
        {title}
      </h3>
      <p
        className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"}`}
      >
        {description}
      </p>
    </motion.div>
  );
}
