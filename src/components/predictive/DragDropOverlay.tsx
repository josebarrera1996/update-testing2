"use client"

import type React from "react"
import { memo } from "react"
import { FileText } from "lucide-react"

interface DragDropOverlayProps {
  isDragging: boolean
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = memo(({ isDragging }) => {
  if (!isDragging) return null

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-end justify-center pb-8 z-50">
      <div className="bg-primary/10 border-2 border-dashed border-primary rounded-lg p-4 sm:p-8 flex flex-col items-center">
        <FileText className="h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-semibold text-primary">Suelta los archivos aquí para añadirlos al chat</p>
        <p className="text-sm text-muted-foreground mt-2">Máximo 5 archivos por chat, 30 MB cada uno</p>
      </div>
    </div>
  )
})

DragDropOverlay.displayName = "DragDropOverlay"

export default DragDropOverlay
