"use client"

interface LoadingStateDebugProps {
  isLoading: boolean
  isSubscribed: boolean
  sessionId: string | null
  error: string | null
}

export function LoadingStateDebug({ isLoading, isSubscribed, sessionId, error }: LoadingStateDebugProps) {
  if (process.env.NODE_ENV !== "development") return null

  return (
    <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50 max-w-[200px] sm:max-w-none">
      <div className="truncate">Session: {sessionId}</div>
      <div>Loading: {isLoading ? "🔴" : "🟢"}</div>
      <div>Subscribed: {isSubscribed ? "📡" : "📴"}</div>
      {error && <div className="text-red-400 truncate">Error: {error}</div>}
    </div>
  )
}
