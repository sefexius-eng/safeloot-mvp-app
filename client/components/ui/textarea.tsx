import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-32 w-full rounded-md border border-white/10 bg-[#13171F] p-3 text-sm text-white shadow-[0_18px_44px_rgba(0,0,0,0.28)] outline-none transition placeholder:text-gray-500 focus:border-[#00C853] focus:ring-1 focus:ring-[#00C853] disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };