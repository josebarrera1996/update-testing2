"use client"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { motion } from "framer-motion"

interface PredictiveScrollProps {
  onClick: () => void
}

export const PredictiveScroll = ({ onClick }: PredictiveScrollProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed bottom-20 right-3 sm:bottom-24 sm:right-4 z-50"
    >
      <Button
        variant="secondary"
        size="icon"
        onClick={onClick}
        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
      >
        <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
    </motion.div>
  )
}

export default PredictiveScroll
