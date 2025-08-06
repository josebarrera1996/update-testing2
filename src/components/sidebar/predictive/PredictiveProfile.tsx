//go givenchy
"use client"

import { useState } from "react"
import { User, Settings, LogOut, ChevronDown, Brain } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import Image from "next/image"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { useTheme } from "@/context/ThemeContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MemoryModal } from "./MemoryModal"

interface ProfileImageProps {
  user: SupabaseUser
}

const ProfileImage = ({ user }: ProfileImageProps) => {
  const [imageError, setImageError] = useState(false)

  const getProfileImage = () => {
    if (imageError) return null
    if (user.app_metadata?.provider === "google") {
      return user.user_metadata?.picture || user.user_metadata?.avatar_url
    }
    return user.user_metadata?.avatar_url
  }

  const profileImageUrl = getProfileImage()

  if (profileImageUrl && !imageError) {
    return (
      <div className="relative w-10 h-10">
        <Image
          src={profileImageUrl || "/placeholder.svg"}
          alt="Profile"
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  return (
    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
      <User className="w-6 h-6 text-muted-foreground" />
    </div>
  )
}

interface PredictiveProfileProps {
  user: SupabaseUser | null
  isCollapsed?: boolean
}

export function PredictiveProfile({ user, isCollapsed = false }: PredictiveProfileProps) {
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const supabase = createClient()
  const { theme } = useTheme()

  if (!user) return null

  const getDisplayName = (user: SupabaseUser) => {
    return user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuario"
  }

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await supabase.auth.signOut()
  }

  const handleMemoryModal = () => {
    setDropdownOpen(false)
    setIsMemoryModalOpen(true)
  }

  const handleSettings = () => {
    setDropdownOpen(false)
    // Navegar a settings
  }

  if (isCollapsed) {
    return (
      <div className="pt-4 pb-6 flex justify-center">
        <ProfileImage user={user} />
      </div>
    )
  }

  return (
    <>
      <div className={`${theme === "dark" ? "bg-black/80 text-white" : "bg-white text-black"}`}>
        <div className="p-4">
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors">
                <ProfileImage user={user} />
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-medium truncate">{getDisplayName(user)}</p>
                  <p className={`text-sm truncate ${theme === "dark" ? "text-white/50" : "text-black/50"}`}>
                    {user.email}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 mb-2" side="top">
              <DropdownMenuItem onClick={handleMemoryModal}>
                <Brain className="w-4 h-4 mr-2" />
                Gestionar memoria
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <MemoryModal isOpen={isMemoryModalOpen} onClose={() => setIsMemoryModalOpen(false)} userId={user.id} />
    </>
  )
}
