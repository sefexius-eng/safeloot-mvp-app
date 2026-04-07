"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-white/10 bg-white/10 p-0.5 shadow-[0_10px_28px_rgba(0,0,0,0.22)] outline-none transition data-[state=checked]:border-orange-400/40 data-[state=checked]:bg-orange-500/20 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 focus-visible:ring-4 focus-visible:ring-orange-500/15",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block h-5 w-5 rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,0.25)] transition data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };