"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Edit2,
  Download,
  Trash2,
  MoreVertical,
  X,
  CheckIcon,
  Loader2,
} from "lucide-react";
import type { Chat } from "@/components/predictive/PredictiveTypes";
import { useTheme } from "@/context/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type ChatWithFlag = Chat & { _nameChanged?: boolean };
interface PredictiveChatItemProps {
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onEditSubmit: (e: React.FormEvent) => void;
  onEditCancel: () => void;
  setEditingName: (name: string) => void;
  chat: ChatWithFlag;
  isDeleting?: boolean; // Nueva prop para estado de eliminación
}

export function PredictiveChatItem({
  chat,
  isActive,
  isEditing,
  editingName,
  onSelect,
  onEdit,
  onDelete,
  onExport,
  onEditSubmit,
  onEditCancel,
  setEditingName,
  isDeleting = false, // Nueva prop
}: PredictiveChatItemProps) {
  const { theme } = useTheme();
  const [displayedName, setDisplayedName] = useState(chat.name);
  const [typing, setTyping] = useState(false);
  const prevNameRef = useRef(chat.name);

  // Detectar cambio de nombre y ejecutar animación de "escritura"
  useEffect(() => {
    if (
      prevNameRef.current !== chat.name &&
      !chat.name.startsWith("Proyecto") // Animar solo si ya no es provisional
    ) {
      setTyping(true);
      setDisplayedName(""); // Comienza vacío
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedName(chat.name.slice(0, i + 1));
        i++;
        if (i >= chat.name.length) {
          clearInterval(interval);
          setTyping(false);
          prevNameRef.current = chat.name; // Guardar el nombre final
        }
      }, 40); // velocidad de "escritura"
      return () => clearInterval(interval);
    } else {
      setDisplayedName(chat.name);
      prevNameRef.current = chat.name;
    }
  }, [chat.name]);

  const baseStyles =
    "flex items-center w-full py-2 rounded-xl cursor-pointer transition-colors duration-200";
  const activeStyles = "bg-muted text-foreground dark:bg-card dark:text-white";
  const hoverStyles =
    "hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-white";

  const truncateName = (name: string, maxLength = 28) => {
    if (name.length <= maxLength) return name;
    return `${name.slice(0, maxLength)}...`;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={chat.session_id}
        className={`${baseStyles} ${
          isActive ? activeStyles : `text-muted-foreground ${hoverStyles}`
        } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
        onClick={!isEditing && !isDeleting ? onSelect : undefined}
        whileHover={!isDeleting ? { scale: 1.01 } : {}}
        transition={{ duration: 0.2 }}
        initial={{ opacity: 1, height: "auto" }}
        exit={{
          opacity: 0,
          height: 0,
          marginBottom: 0,
          transition: { duration: 0.3, ease: "easeInOut" },
        }}
      >
        {isEditing ? (
          <form
            onSubmit={onEditSubmit}
            className="flex items-center gap-[2px] w-60"
          >
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="flex-1 bg-card text-foreground rounded px-2 py-1 text-sm focus:ring-1 focus:ring-ring"
              autoFocus
              disabled={isDeleting}
            />
            <div className="flex-shrink-0 flex items-center gap-1">
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-600 hover:text-green-700"
                disabled={isDeleting}
              >
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onEditCancel}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={isDeleting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center w-full">
            <div className="flex-1 min-w-0 overflow-hidden " title={chat.name}>
              <span
                className={`block truncate text-xs font-medium pl-2   text-foreground/80 ${
                  typing ? "animate-pulse" : ""
                }`}
              >
                {truncateName(displayedName)}
              </span>
            </div>
            <div className="flex-shrink-0 flex items-center gap-0">
              {isDeleting ? (
                <div className="flex items-center justify-center w-[40px] h-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground text-xs hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Abrir menú de acciones"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                    >
                      <Edit2 className="h-3 w-4 mr-2" /> Editar nombre
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport();
                      }}
                    >
                      <Download className="h-3 w-4 mr-2" /> Importar chat
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-4 mr-2" /> Borrar chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default PredictiveChatItem;
