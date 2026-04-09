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

function hasCustomBackground(className?: string) {
  return Boolean(className && /(^|\s)!?bg-|(^|\s)!?bg-\[/.test(className));
}

function hasCustomTextColor(className?: string) {
  return Boolean(className && /(^|\s)!?text-/.test(className));
}

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
    const usesCustomBackground = hasCustomBackground(className);
    const usesCustomTextColor = hasCustomTextColor(className);

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00C853]/15 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
          variant === "default"
            ? usesCustomBackground
              ? cn(!usesCustomTextColor && "text-white")
              : "border border-[#00C853]/35 bg-[#00C853] text-[#0A0D14] shadow-[0_18px_42px_rgba(0,200,83,0.24)] hover:-translate-y-0.5 hover:bg-[#00B04A]"
            : variantClasses[variant],
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