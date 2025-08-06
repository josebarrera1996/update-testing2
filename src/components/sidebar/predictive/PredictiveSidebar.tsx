"use client";

import type React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { PredictiveHeader } from "./PredictiveHeader";
import { PredictiveControls } from "./PredictiveControls";
import { PredictiveChatList } from "./PredictiveChatList";
import { PredictiveProfile } from "./PredictiveProfile";
import type { Chat } from "@/components/predictive/PredictiveTypes";
import type { User } from "@supabase/supabase-js";
import { Menu } from "lucide-react";

interface PredictiveSidebarProps {
  chats: Chat[];
  currentSessionId: string | null;
  onSelectChat: (session_id: string, shouldCloseCanvas?: boolean) => void;
  // ✅ ARREGLAR: Cambiar el tipo de retorno para que coincida con la nueva implementación
  onNewChat: () => Promise<string | null>;
  onEditChatName: (session_id: string, newName: string) => void;
  onDeleteChat: (session_id: string) => void;
  onExportChat: (session_id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  user: User | null;
  onRoleChange: (role: string) => Promise<void>;
  currentRole: string | null;
  deletingChatIds: Set<string>;
  // ✅ NUEVA PROP: Para mostrar el chat pendiente
  pendingChatName?: string | null;
}

export function PredictiveSidebar({
  chats,
  currentSessionId,
  onSelectChat,
  onNewChat,
  onEditChatName,
  onDeleteChat,
  onExportChat,
  isCollapsed,
  onToggleCollapse,
  user,
  onRoleChange,
  currentRole,
  deletingChatIds,
  pendingChatName,
}: PredictiveSidebarProps) {
  const handleNewChat = async () => {
    await onNewChat();
  };

  const handleRoleChange = async (role: string) => {
    await onRoleChange(role);
  };

  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingChatId && editingName.trim()) {
        await onEditChatName(editingChatId, editingName);
        setEditingChatId(null);
        setEditingName("");
      }
    },
    [editingChatId, editingName, onEditChatName]
  );

  // ✅ NUEVO: Crear lista de chats que incluya el chat pendiente
  const displayChats = useMemo(() => {
    const chatList = [...chats];
    if (pendingChatName) {
      // Agregar el chat pendiente al inicio de la lista
      chatList.unshift({
        id: "pending",
        session_id: "pending",
        name: pendingChatName,
        user_id: user?.id || "",
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project_id: "",
        version_id: 0,
        isPending: true, // Marcador para identificar que es pendiente
      } as Chat & { isPending: boolean });
    }
    return chatList;
  }, [chats, pendingChatName, user?.id]);

  if (isCollapsed) {
    return (
      <div className="fixed top-0 left-0 z-40 flex items-center justify-center gap-2 p-2 bg-transparent">
        <Link href="/studio">
          <div className="relative w-9 h-9">
            <Image
              src={
                theme === "dark"
                  ? "/images/Logo-mini.png"
                  : "/images/logo-mini-light.png"
              }
              alt="Hestia Mini Logo"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-contain"
              priority
            />
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={`text-muted-foreground ${
            theme == "dark" ? "hover:bg-card" : "hover-bg-muted"
          } `}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Sidebar expandido
  return (
    <motion.div
      className={`fixed top-0 left-0 h-screen ${
        isMobile ? "w-full" : "w-64"
      } z-40 flex flex-col border-r border-border bg-background`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PredictiveHeader onToggleCollapse={onToggleCollapse} />

      <div className="px-2 py-4">
        <PredictiveControls
          onNewChat={handleNewChat}
          user={user}
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
        />
      </div>

      <ScrollArea className="flex-1 px-2 w-full">
        <PredictiveChatList
          chats={displayChats} // ✅ USAR LA LISTA QUE INCLUYE EL CHAT PENDIENTE
          currentSessionId={currentSessionId}
          onSelectChat={(sessionId) => {
            // ✅ NUEVO: No permitir seleccionar el chat pendiente
            if (sessionId !== "pending") {
              onSelectChat(sessionId, true);
            }
          }}
          onEditChatName={onEditChatName}
          onDeleteChat={onDeleteChat}
          onExportChat={onExportChat}
          editingChatId={editingChatId}
          editingName={editingName}
          setEditingName={setEditingName}
          handleEditSubmit={handleEditSubmit}
          handleEditClick={(chat) => {
            // ✅ NUEVO: No permitir editar el chat pendiente
            if (!(chat as any).isPending) {
              setEditingChatId(chat.session_id);
              setEditingName(chat.name);
            }
          }}
          handleCancelEdit={() => {
            setEditingChatId(null);
            setEditingName("");
          }}
          deletingChatIds={deletingChatIds}
          // ✅ NUEVO: Pasar información sobre chat pendiente
          pendingChatId={pendingChatName ? "pending" : null}
        />
      </ScrollArea>

      <PredictiveProfile user={user} isCollapsed={isCollapsed} />
    </motion.div>
  );
}

export default PredictiveSidebar;
