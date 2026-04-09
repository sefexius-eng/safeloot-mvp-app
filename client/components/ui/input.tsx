import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-white/10 bg-[rgba(22,27,34,0.88)] px-4 text-sm text-zinc-100 shadow-[0_18px_44px_rgba(0,0,0,0.28)] outline-none transition placeholder:text-zinc-500 focus:border-[#00C853]/45 focus:bg-[rgba(26,29,36,0.96)] focus:ring-4 focus:ring-[#00C853]/10 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };