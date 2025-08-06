"use client";

import { useCallback } from "react";

export function usePendingMessage() {
  // Fetch el pending_message para un session_id
  const getPending = useCallback(async (session_id: string) => {
    try {
      const res = await fetch(
        `/api/hestia-states/pending?session_id=${session_id}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.pending_messages || null;
    } catch (error) {
      console.error("Error fetching pending message:", error);
      return null;
    }
  }, []);

  // Guardar/setear el pending_message (POST)
  const setPending = useCallback(
    async (session_id: string, pending_message: any) => {
      try {
        const response = await fetch(`/api/hestia-states/pending`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id, pending_message }),
        });
        if (!response.ok) {
          console.error(
            "Failed to set pending message:",
            await response.text()
          );
        }
      } catch (error) {
        console.error("Error setting pending message:", error);
      }
    },
    []
  );

  // Limpiar el pending_message (DELETE)
  const clearPending = useCallback(async (session_id: string) => {
    try {
      const response = await fetch(`/api/hestia-states/pending`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });
      if (!response.ok) {
        console.error(
          "Failed to clear pending message:",
          await response.text()
        );
      }
    } catch (error) {
      console.error("Error clearing pending message:", error);
    }
  }, []);

  return { getPending, setPending, clearPending };
}
