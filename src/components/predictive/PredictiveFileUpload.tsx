"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Paperclip } from "lucide-react"

interface PredictiveFileUploadProps {
  onFileUpload: (file: File) => void
  currentUploadCount: number
  disabled?: boolean
}

export function PredictiveFileUpload({ onFileUpload, currentUploadCount, disabled }: PredictiveFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      onFileUpload(files[0])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <>
      <input ref={fileInputRef} type="file" onChange={handleChange} className="hidden" accept="*/*" />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-card hover:bg-background"
        disabled={disabled}
      >
        <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
    </>
  )
}
