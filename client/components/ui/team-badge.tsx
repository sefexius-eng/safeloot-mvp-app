import type { Role } from "@prisma/client";

import { isTeamRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  role?: Role | null;
  className?: string;
}

export function TeamBadge({ role, className }: TeamBadgeProps) {
  if (!isTeamRole(role)) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white",
        className,
      )}
    >
      🛡️ TEAM
    </span>
  );
}