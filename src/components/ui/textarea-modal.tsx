import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const TextareaModal = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border-none bg-muted px-4 py-3 text-sm text-text focus-visible:outline-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
TextareaModal.displayName = "Textarea";

export { TextareaModal };
