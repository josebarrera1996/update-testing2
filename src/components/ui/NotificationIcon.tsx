// components/ui/NotificationIcon.tsx
import { Bell } from "lucide-react";

interface NotificationIconProps {
  hasNotifications?: boolean;
  count?: number;
}

export function NotificationIcon({
  hasNotifications = true,
  count,
}: NotificationIconProps) {
  return (
    <div className="relative inline-block">
      <button className="p-2 hover:bg-accent rounded-md transition-colors">
        <Bell className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
      </button>
      {hasNotifications && (
        <div className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-background">
            {count && count > 0 && (
              <span className="absolute -top-2 -right-2 text-xs text-white bg-red-500 rounded-full px-1 min-w-[1.2rem] text-center">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
