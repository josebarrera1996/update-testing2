"use client"

import type React from "react"
import { useRef, useEffect, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, X } from "lucide-react"

interface EditMessageProps {
  editedContent: string
  setEditedContent: (content: string) => void
  handleSaveEdit: () => void
  handleCancelEdit: () => void
  isLoading?: boolean
}

export const EditMessage: React.FC<EditMessageProps> = memo(
  ({ editedContent, setEditedContent, handleSaveEdit, handleCancelEdit, isLoading = false }) => {
    const editTextareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus()
        // Solo posicionar el cursor al inicio de la edición, no con cada cambio.
        // La longitud del texto para setSelectionRange solo se obtiene en la primera renderización
        // para mantener la posición del cursor, o al editar el texto original.
        const length = editedContent.length
        editTextareaRef.current.setSelectionRange(length, length)
      }
    }, []) // Dependencia vacía para que se ejecute solo al montar el componente

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Escape") {
          handleCancelEdit()
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          handleSaveEdit()
        }
      },
      [handleCancelEdit, handleSaveEdit],
    )

    return (
      <div className="space-y-3">
        <Textarea
          ref={editTextareaRef}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[100px] resize-none"
          placeholder="Edita tu mensaje..."
          disabled={isLoading}
        />
        <div className="flex gap-2 justify-end">
          <Button
            onClick={handleCancelEdit}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className=" bg-background text-text hover:bg-background/50"
          >
            <X className="h-4 w-4 mr-1 text-red-700" />
            Cancelar
          </Button>
          <Button
            onClick={handleSaveEdit}
            size="sm"
            disabled={isLoading || !editedContent.trim()}
            className=" bg-background text-text hover:bg-background/50"
          >
            <Check className="h-4 w-4 mr-1 text-green-700" />
            {isLoading ? "Enviando..." : "Guardar"}
          </Button>
        </div>
      </div>
    )
  },
)

EditMessage.displayName = "EditMessage"

export default EditMessage
