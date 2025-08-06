"use client";

import { useState, useCallback } from "react";
import type {
  Message,
  Attachment,
} from "@/components/predictive/PredictiveTypes";

interface UsePredictiveEditParams {
  handleSend: (content: string, attachments?: Attachment[]) => void;
  messages: Message[];
  updateMessages: (messages: Message[]) => void;
}

export function usePredictiveEdit({
  handleSend,
  messages,
  updateMessages,
}: UsePredictiveEditParams) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditLoading, setIsEditLoading] = useState(false);

  const startEdit = useCallback((messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditedContent(currentContent);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditedContent("");
    setIsEditLoading(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingMessageId || !editedContent.trim()) return;

    const messageToEdit = messages.find((msg) => msg.id === editingMessageId);
    if (!messageToEdit) return;

    setIsEditLoading(true);

    try {
      // ✅ NUEVA LÓGICA: No eliminar mensajes, solo enviar el editado como nuevo mensaje
      console.log("📝 Enviando mensaje editado como nuevo mensaje al final");

      // Limpiar el estado de edición primero
      setEditingMessageId(null);
      setEditedContent("");

      // Enviar el mensaje editado como un nuevo mensaje (se añadirá al final)
      await handleSend(editedContent.trim(), messageToEdit.attachments);

      console.log("✅ Mensaje editado enviado correctamente");
    } catch (error) {
      console.error("❌ Error al guardar la edición:", error);
      // En caso de error, restaurar el estado de edición
      setEditingMessageId(editingMessageId);
      setEditedContent(editedContent);
    } finally {
      setIsEditLoading(false);
    }
  }, [editingMessageId, editedContent, messages, handleSend]);

  return {
    editingMessageId,
    editedContent,
    isEditLoading,
    setEditedContent,
    startEdit,
    cancelEdit,
    saveEdit,
    isEditing: editingMessageId !== null,
  };
}
