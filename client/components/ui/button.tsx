import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "ghost";
type ButtonSize = "default" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-neutral-950 text-white shadow-[0_16px_40px_rgba(17,24,39,0.22)] hover:-translate-y-0.5 hover:bg-orange-700",
  ghost:
    "bg-transparent text-zinc-200 shadow-none hover:translate-y-0 hover:bg-white/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-5",
  icon: "h-10 w-10 px-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      type = "button",
      variant = "default",
      size = "default",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };