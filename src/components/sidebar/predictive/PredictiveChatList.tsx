"use client";

import type React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, memo, useMemo } from "react";
import { PredictiveChatItem } from "./PredictiveChatItem";
import type { Chat } from "@/components/predictive/PredictiveTypes";
import { useTheme } from "@/context/ThemeContext";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// ✅ EXTENDER EL TIPO Chat para incluir isPending
type ExtendedChat = Chat & { isPending?: boolean };

interface PredictiveChatListProps {
  chats: ExtendedChat[];
  currentSessionId: string | null;
  onSelectChat: (session_id: string) => void;
  onEditChatName: (session_id: string, newName: string) => void;
  onDeleteChat: (session_id: string) => void;
  onExportChat: (session_id: string) => void;
  editingChatId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  handleEditSubmit: (e: React.FormEvent) => void;
  handleEditClick: (chat: ExtendedChat) => void;
  handleCancelEdit: () => void;
  deletingChatIds: Set<string>;
  // ✅ NUEVA PROP: ID del chat pendiente
  pendingChatId?: string | null;
}

export const PredictiveChatList = memo(function PredictiveChatList({
  chats,
  currentSessionId,
  onSelectChat,
  onEditChatName,
  onDeleteChat,
  onExportChat,
  editingChatId,
  editingName,
  setEditingName,
  handleEditSubmit,
  handleEditClick,
  handleCancelEdit,
  deletingChatIds,
  pendingChatId,
}: PredictiveChatListProps) {
  const { theme } = useTheme();

  const handleSelect = useCallback(
    (session_id: string) => {
      onSelectChat(session_id);
    },
    [onSelectChat]
  );

  const handleEdit = useCallback(
    (chat: ExtendedChat) => {
      handleEditClick(chat);
    },
    [handleEditClick]
  );

  const handleDelete = useCallback(
    (session_id: string) => {
      onDeleteChat(session_id);
    },
    [onDeleteChat]
  );

  const handleExport = useCallback(
    (session_id: string) => {
      onExportChat(session_id);
    },
    [onExportChat]
  );

  const chatItems = useMemo(() => {
    if (!chats || chats.length === 0) {
      return (
        <div
          className={`text-center py-4 ${
            theme === "dark" ? "text-white/50" : "text-black/50"
          }`}
        >
          <p>No hay conversaciones aún</p>
          <p className="text-sm mt-2">
            Crea una nueva conversación para empezar
          </p>
        </div>
      );
    }

    return chats.map((chat, index) => {
      const isDeleting = deletingChatIds.has(chat.session_id);
      const isPending = chat.isPending || chat.session_id === pendingChatId;
      const isSelected = currentSessionId === chat.session_id;
      const isEditing = editingChatId === chat.session_id;

      // ✅ NUEVO: Renderizar chat pendiente con estilo especial
      if (isPending) {
        return (
          <motion.div
            key={chat.session_id}
            className={`group relative rounded-lg transition-all duration-200 ${
              theme === "dark" ? "bg-card/50" : "bg-muted/50"
            }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex py-1">
              <Button
                variant="ghost"
                className="flex-1 justify-start h-auto py-2 px-0 text-left font-normal cursor-default"
                disabled
              >
                <div className="flex w-full">
                  <div className="h-3 w-3 text-muted-foreground flex-shrink-0 animate-pulse" />
                  <span className="truncate text-xs">Nuevo Chat</span>
                </div>
              </Button>
            </div>
            {/* Indicador de estado para chat pendiente */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse rounded-lg pointer-events-none" />
          </motion.div>
        );
      }

      // ✅ RENDERIZAR CHAT NORMAL
      return (
        <AnimatePresence key={chat.session_id} mode="wait">
          {!isDeleting && (
            <motion.div
              initial={{ opacity: 1, height: "auto" }}
              exit={{
                opacity: 0,
                height: 0,
                marginBottom: 0,
                transition: { duration: 0.3, ease: "easeInOut" },
              }}
            >
              <PredictiveChatItem
                chat={chat}
                isActive={isSelected}
                isEditing={isEditing}
                editingName={editingName}
                onSelect={() => handleSelect(chat.session_id)}
                onEdit={() => handleEdit(chat)}
                onDelete={() => handleDelete(chat.session_id)}
                onExport={() => handleExport(chat.session_id)}
                onEditSubmit={handleEditSubmit}
                onEditCancel={handleCancelEdit}
                setEditingName={setEditingName}
                isDeleting={isDeleting}
              />
            </motion.div>
          )}
        </AnimatePresence>
      );
    });
  }, [
    chats,
    currentSessionId,
    editingChatId,
    editingName,
    handleSelect,
    handleEdit,
    handleDelete,
    handleExport,
    handleEditSubmit,
    handleCancelEdit,
    setEditingName,
    theme,
    deletingChatIds,
    pendingChatId,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-2 w-full"
    >
      {chatItems}
    </motion.div>
  );
});

PredictiveChatList.displayName = "PredictiveChatList";

export default PredictiveChatList;
