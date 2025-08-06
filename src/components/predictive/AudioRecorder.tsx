"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Square } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface AudioRecorderProps {
  onTranscriptionComplete: (transcription: string) => void
  disabled?: boolean
}

export const AudioRecorder: React.FC<AudioRecorderProps> = memo(({ onTranscriptionComplete, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioData, setAudioData] = useState<number[]>(Array(20).fill(0))
  const animationRef = useRef<number | undefined>(undefined)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  const isIOS = useCallback(() => {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    )
  }, [])

  const animateWaveform = useCallback(() => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current)
      const newAudioData = Array.from(dataArrayRef.current.slice(0, 20)).map((value) => value / 255)
      setAudioData(newAudioData)
      animationRef.current = requestAnimationFrame(animateWaveform)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      let mediaRecorder
      if (isIOS()) {
        mediaRecorder = new MediaRecorder(stream)
      } else {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        })
      }

      mediaRecorderRef.current = mediaRecorder

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 64
      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)

      const audioChunks: Blob[] = []
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, {
          type: isIOS() ? "audio/wav" : "audio/webm",
        })
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = async () => {
          const base64Audio = reader.result as string
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio: base64Audio.split(",")[1],
              platform: isIOS() ? "ios" : "other",
            }),
          })
          const data = await response.json()
          onTranscriptionComplete(data.transcription)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      animateWaveform()
    } catch (error) {
      console.error("Error al iniciar la grabación:", error)
    }
  }, [onTranscriptionComplete, animateWaveform, isIOS])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      cancelAnimationFrame(animationRef.current!)
      setDuration(0)
      setAudioData(Array(20).fill(0))
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (disabled) return

    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording, disabled])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "R") {
        event.preventDefault()
        toggleRecording()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [toggleRecording])

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }, [])

  return (
    <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-end gap-2">
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex items-center space-x-2 bg-red-100 dark:bg-red-900 rounded-full px-3 py-1"
          >
            <span className="text-xs text-red-500 dark:text-red-400 font-medium">{formatTime(duration)}</span>
            <div className="flex space-x-1">
              {audioData.map((value, index) => (
                <div
                  key={index}
                  className="w-1 bg-red-500 dark:bg-red-400"
                  style={{
                    height: `${Math.max(4, value * 20)}px`,
                    transition: "height 0.1s ease",
                  }}
                />
              ))}
            </div>
            <Button
              onClick={stopRecording}
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={`h-10 w-10 rounded-full ${
                isRecording ? "bg-red-500 text-white hover:bg-red-600" : ""
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Square className="h-4 w-4 text-red-500 dark:text-red-400" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <Button
        onClick={toggleRecording}
        variant="outline"
        size="icon"
        disabled={disabled}
        className={`h-10 w-10 rounded-full ${isRecording ? "bg-red-500 text-white hover:bg-red-600" : ""}`}
      >
        <Mic className="h-4 w-4" />
      </Button>
    </div>
  )
})

AudioRecorder.displayName = "AudioRecorder"

export default AudioRecorder
