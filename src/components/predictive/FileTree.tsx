"use client"
import { FolderIcon, FileIcon } from "lucide-react"

interface FileTreeItem {
  name: string
  type: "file" | "folder"
  children?: FileTreeItem[]
  changes?: number
}

interface FileTreeProps {
  items: FileTreeItem[]
  onSelect?: (path: string) => void
}

export function FileTree({ items, onSelect }: FileTreeProps) {
  const renderItem = (item: FileTreeItem, path = "") => {
    const fullPath = `${path}/${item.name}`

    return (
      <div key={item.name}>
        <div
          className="file-tree-item flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer hover:bg-muted/50 text-sm"
          onClick={() => item.type === "file" && onSelect?.(fullPath)}
        >
          {item.type === "folder" ? <FolderIcon className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
          <span>{item.name}</span>
          {item.changes !== undefined && item.changes > 0 && <span className="changes">+{item.changes}</span>}
        </div>
        {item.children && (
          <div className="ml-2 sm:ml-4">{item.children.map((child) => renderItem(child, fullPath))}</div>
        )}
      </div>
    )
  }

  return <div className="p-2">{items.map((item) => renderItem(item))}</div>
}
