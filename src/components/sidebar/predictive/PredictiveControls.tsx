"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase-client";
import { User } from "@/components/predictive/PredictiveTypes";

interface PredictiveControlsProps {
  onNewChat: () => Promise<void>;
  user: User | null;
  currentRole: string | null;
  onRoleChange: (role: string) => Promise<void>;
}

export function PredictiveControls({
  onNewChat,
  user,
  currentRole,
  onRoleChange,
}: PredictiveControlsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const { theme } = useTheme();
  const supabase = createClient();

  // Cargar roles disponibles
  useEffect(() => {
    const fetchRoles = async () => {
      const { data, error } = await supabase
        .from("hestia_roles")
        .select("role");

      if (data) {
        const roleList = data.map((item) => item.role).filter(Boolean);
        setRoles(roleList);
      }
    };

    fetchRoles();
  }, []);

  const handleNewChat = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onNewChat();
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (selectedRole: string) => {
    if (user) {
      await onRoleChange(selectedRole);
    }
  };

  return (
    <div className="space-y-3">
      {/* Botón Nueva Conversación */}
      <Button
        onClick={handleNewChat}
        disabled={isCreating}
        className={`w-full justify-start px-4 py-2 rounded-lg 
          ${
            theme === "dark"
              ? "bg-card text-white"
              : "bg-muted text-black hover:bg-muted/80"
          }
        `}
      >
        <Plus className="h-5 w-5 mr-2 text-green-600" />
        <span className="font-medium">Nueva Conversación</span>
      </Button>

      {/* Selector de Rol */}
      <Select value={currentRole || ""} onValueChange={handleRoleChange}>
        <SelectTrigger
          className={`w-full ${
            theme === "dark" ? "bg-card text-white" : "bg-muted text-black"
          }`}
        >
          <SelectValue placeholder="Selecciona un rol" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
