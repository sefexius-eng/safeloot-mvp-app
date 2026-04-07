import type { Role } from "@prisma/client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface ProfileRoleBadgeProps {
  role?: Role | null;
  className?: string;
}

function getRoleVariant(role: Role | null | undefined): BadgeProps["variant"] {
  switch (role) {
    case "MODERATOR":
      return "info";
    case "ADMIN":
      return "warning";
    case "SUPER_ADMIN":
      return "destructive";
    case "USER":
    default:
      return "secondary";
  }
}

function getProfileRoleLabel(role: Role | null | undefined) {
  if (!role || role === "USER") {
    return "Продавец";
  }

  return getRoleLabel(role);
}

export function ProfileRoleBadge({ role, className }: ProfileRoleBadgeProps) {
  return (
    <Badge
      variant={getRoleVariant(role)}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[11px] tracking-[0.16em] text-white/95",
        className,
      )}
    >
      {getProfileRoleLabel(role)}
    </Badge>
  );
}