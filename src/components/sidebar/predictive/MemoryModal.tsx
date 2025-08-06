//givenchy
"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Edit2, Save, X, AlertTriangle, Loader2, MoreHorizontal } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import { useToast } from "@/hooks/use-toast"
import { Brain } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Memory {
  id: string
  user_id: string
  keyword: string // JSON array
  context: string // JSON array
  suggested_action: string // JSON array
  created_at: string
  updated_at: string
}

interface MemoryItem {
  id: string // ID del registro principal
  index: number // Índice en el array
  context: string
  keyword?: string
  suggested_action?: string
  created_at: string
  updated_at: string
}

// Funciones helper para parsear JSON
const parseJsonField = (field: string | null | undefined): string[] => {
  if (!field) return []

  try {
    if (Array.isArray(field)) return field
    if (typeof field === "string") {
      const parsed = JSON.parse(field)
      return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean)
    }
    return []
  } catch (error) {
    console.error("Error parsing JSON field:", field, error)
    return typeof field === "string" ? [field] : []
  }
}

const stringifyJsonField = (array: string[]): string => {
  return JSON.stringify(array.filter((item) => item && item.trim()))
}

interface MemoryModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

export function MemoryModal({ isOpen, onClose, userId }: MemoryModalProps) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(false)

  // Estados para el modal de edición
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{ id: string; index: number } | null>(null)
  const [editingContent, setEditingContent] = useState({
    context: "",
    keyword: "",
    suggested_action: "",
  })

  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [deleteItemInfo, setDeleteItemInfo] = useState<{ id: string; index: number } | null>(null)
  const supabase = createClient()
  const { toast } = useToast()

  // Convertir memorias a items individuales
  const convertMemoriesToItems = useCallback((memories: Memory[]): MemoryItem[] => {
    const items: MemoryItem[] = []

    memories.forEach((memory) => {
      const contexts = parseJsonField(memory.context)
      const keywords = parseJsonField(memory.keyword)
      const actions = parseJsonField(memory.suggested_action)

      contexts.forEach((context, index) => {
        items.push({
          id: memory.id,
          index,
          context,
          keyword: keywords[index] || "",
          suggested_action: actions[index] || "",
          created_at: memory.created_at,
          updated_at: memory.updated_at,
        })
      })
    })

    return items
  }, [])

  // Cargar memorias del usuario
  const fetchMemories = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("hestia_ai_user_memory")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setMemories(data || [])
      const items = convertMemoriesToItems(data || [])
      setMemoryItems(items)
    } catch (error) {
      console.error("Error fetching memories:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las memorias",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [userId, supabase, toast, convertMemoriesToItems])

  // Cargar memorias cuando se abre el modal
  useEffect(() => {
    if (isOpen && userId) {
      fetchMemories()
    }
  }, [isOpen, userId, fetchMemories])

  // Abrir modal de edición
  const handleEditItem = (item: MemoryItem) => {
    setEditingItem({ id: item.id, index: item.index })
    setEditingContent({
      context: item.context,
      keyword: item.keyword || "",
      suggested_action: item.suggested_action || "",
    })
    setEditModalOpen(true)
  }

  // Guardar edición de item individual
  const handleSaveEdit = async () => {
    if (!editingItem) return

    try {
      // Encontrar la memoria original
      const originalMemory = memories.find((m) => m.id === editingItem.id)
      if (!originalMemory) return

      // Parsear los arrays actuales
      const contexts = parseJsonField(originalMemory.context)
      const keywords = parseJsonField(originalMemory.keyword)
      const actions = parseJsonField(originalMemory.suggested_action)

      // Actualizar el elemento específico
      contexts[editingItem.index] = editingContent.context
      keywords[editingItem.index] = editingContent.keyword
      actions[editingItem.index] = editingContent.suggested_action

      // Actualizar en la base de datos
      const updatedData = {
        keyword: stringifyJsonField(keywords),
        context: stringifyJsonField(contexts),
        suggested_action: stringifyJsonField(actions),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("hestia_ai_user_memory").update(updatedData).eq("id", editingItem.id)

      if (error) throw error

      // Actualizar estado local
      setMemories((prev) =>
        prev.map((memory) =>
          memory.id === editingItem.id
            ? {
                ...memory,
                ...updatedData,
              }
            : memory,
        ),
      )

      // Regenerar items
      const updatedMemories = memories.map((memory) =>
        memory.id === editingItem.id ? { ...memory, ...updatedData } : memory,
      )
      setMemoryItems(convertMemoriesToItems(updatedMemories))

      // Cerrar modal de edición
      setEditModalOpen(false)
      setEditingItem(null)
      setEditingContent({ context: "", keyword: "", suggested_action: "" })

      toast({
        title: "Memoria actualizada",
        description: "El elemento se ha actualizado correctamente",
      })
    } catch (error) {
      console.error("Error updating memory item:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el elemento",
        variant: "destructive",
      })
    }
  }

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditModalOpen(false)
    setEditingItem(null)
    setEditingContent({ context: "", keyword: "", suggested_action: "" })
  }

  // Eliminar item individual
  const handleDeleteItem = async (itemId: string, itemIndex: number) => {
    try {
      // Encontrar la memoria original
      const originalMemory = memories.find((m) => m.id === itemId)
      if (!originalMemory) return

      // Parsear los arrays actuales
      const contexts = parseJsonField(originalMemory.context)
      const keywords = parseJsonField(originalMemory.keyword)
      const actions = parseJsonField(originalMemory.suggested_action)

      // Eliminar el elemento específico
      contexts.splice(itemIndex, 1)
      keywords.splice(itemIndex, 1)
      actions.splice(itemIndex, 1)

      // Si no quedan elementos, eliminar toda la memoria
      if (contexts.length === 0) {
        const { error } = await supabase.from("hestia_ai_user_memory").delete().eq("id", itemId)
        if (error) throw error

        setMemories((prev) => prev.filter((memory) => memory.id !== itemId))
      } else {
        // Actualizar con los arrays modificados
        const updatedData = {
          keyword: stringifyJsonField(keywords),
          context: stringifyJsonField(contexts),
          suggested_action: stringifyJsonField(actions),
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase.from("hestia_ai_user_memory").update(updatedData).eq("id", itemId)
        if (error) throw error

        setMemories((prev) =>
          prev.map((memory) =>
            memory.id === itemId
              ? {
                  ...memory,
                  ...updatedData,
                }
              : memory,
          ),
        )
      }

      // Regenerar items
      const updatedMemories = memories.filter((m) => m.id !== itemId || contexts.length > 0)
      if (contexts.length > 0) {
        const memoryIndex = updatedMemories.findIndex((m) => m.id === itemId)
        if (memoryIndex !== -1) {
          updatedMemories[memoryIndex] = {
            ...updatedMemories[memoryIndex],
            keyword: stringifyJsonField(keywords),
            context: stringifyJsonField(contexts),
            suggested_action: stringifyJsonField(actions),
            updated_at: new Date().toISOString(),
          }
        }
      }
      setMemoryItems(convertMemoriesToItems(updatedMemories))

      setDeleteItemInfo(null)

      toast({
        title: "Elemento eliminado",
        description: "El elemento se ha eliminado correctamente",
      })
    } catch (error) {
      console.error("Error deleting memory item:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el elemento",
        variant: "destructive",
      })
    }
  }

  // Eliminar todas las memorias
  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase.from("hestia_ai_user_memory").delete().eq("user_id", userId)

      if (error) throw error

      setMemories([])
      setMemoryItems([])
      setDeleteAllDialogOpen(false)

      toast({
        title: "Memorias eliminadas",
        description: "Todas las memorias se han eliminado correctamente",
      })
    } catch (error) {
      console.error("Error deleting all memories:", error)
      toast({
        title: "Error",
        description: "No se pudieron eliminar las memorias",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      {/* Modal principal de memorias */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              <span>Memorias guardadas</span>
            </DialogTitle>
            <DialogDescription>
              Hestia AI intenta recordar la mayoría de tus conversaciones, pero puede olvidar algunas con el tiempo. Las
              memorias guardadas nunca se olvidan.{" "}
              <button className="text-primary hover:underline">Más información</button>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Cargando memorias...</span>
              </div>
            ) : memoryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p>No tienes memorias guardadas aún</p>
                <p className="text-sm mt-1">Las memorias se crearán automáticamente durante tus conversaciones</p>
              </div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3 px-1">
                  {memoryItems.map((item, itemIndex) => (
                    <div
                      key={`${item.id}-${item.index}`}
                      className="border rounded-lg p-3 sm:p-4 bg-card/50 hover:bg-card/70 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="bg-card/50 p-3 sm:p-4 rounded-lg border-l-4 border-quaternary">
                            <p className="text-sm leading-relaxed text-foreground break-words">{item.context}</p>
                          </div>
                        </div>

                        {/* Menú de acciones */}
                        <div className="flex-shrink-0 self-start sm:self-auto">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditItem(item)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setDeleteItemInfo({
                                    id: item.id,
                                    index: item.index,
                                  })
                                }
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="hover:bg-muted w-full sm:w-auto order-2 sm:order-1 bg-transparent"
            >
              Cerrar
            </Button>

            {memoryItems.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setDeleteAllDialogOpen(true)}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar todo
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal separado para edición */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              <span>Editar memoria</span>
            </DialogTitle>
            <DialogDescription>Modifica los campos de esta memoria específica.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block text-foreground">Palabra clave</label>
                  <Textarea
                    value={editingContent.keyword}
                    onChange={(e) =>
                      setEditingContent((prev) => ({
                        ...prev,
                        keyword: e.target.value,
                      }))
                    }
                    className="min-h-[80px] resize-none border-2 border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    placeholder="Ingresa la palabra clave..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block text-foreground">Contexto</label>
                  <Textarea
                    value={editingContent.context}
                    onChange={(e) =>
                      setEditingContent((prev) => ({
                        ...prev,
                        context: e.target.value,
                      }))
                    }
                    className="min-h-[140px] resize-none border-2 border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    placeholder="Describe el contexto de la memoria..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block text-foreground">Acción sugerida</label>
                  <Textarea
                    value={editingContent.suggested_action}
                    onChange={(e) =>
                      setEditingContent((prev) => ({
                        ...prev,
                        suggested_action: e.target.value,
                      }))
                    }
                    className="min-h-[100px] resize-none border-2 border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    placeholder="¿Qué acción se debería tomar con esta información?"
                  />
                </div>
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="w-4 h-4 mr-1" />
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar eliminación de todas las memorias */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              ¿Eliminar todas las memorias?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente todas tus memorias guardadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para confirmar eliminación de elemento individual */}
      <AlertDialog open={!!deleteItemInfo} onOpenChange={() => setDeleteItemInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta memoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El elemento se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemInfo && handleDeleteItem(deleteItemInfo.id, deleteItemInfo.index)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
