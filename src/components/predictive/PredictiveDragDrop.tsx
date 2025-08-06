"use client"
import { Upload } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface PredictiveDragDropProps {
  isDragging: boolean
}

export const PredictiveDragDrop = ({ isDragging }: PredictiveDragDropProps) => {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        >
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="border-2 border-dashed border-primary/50 rounded-lg p-8 sm:p-12 bg-background/50 max-w-sm sm:max-w-md w-full">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-primary animate-bounce" />
                <p className="text-base sm:text-lg font-medium text-center">Suelta los archivos aquí</p>
                <p className="text-xs sm:text-sm text-muted-foreground text-center">Máximo 5 archivos</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PredictiveDragDrop
