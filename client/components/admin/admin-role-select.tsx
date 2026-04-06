"use client";

import type { Role } from "@prisma/client";
import { useEffect, useState, useTransition } from "react";

import { changeUserRole } from "@/app/admin/actions";
import { ROLE_OPTIONS, getRoleLabel } from "@/lib/roles";

interface AdminRoleSelectProps {
  userId: string;
  currentRole: Role;
  isCurrentUser: boolean;
}

export function AdminRoleSelect({
  userId,
  currentRole,
  isCurrentUser,
}: AdminRoleSelectProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole]);

  function handleChange(nextRole: Role) {
    if (nextRole === selectedRole) {
      return;
    }

    const previousRole = selectedRole;
    setSelectedRole(nextRole);
    setError(null);

    startTransition(() => {
      void changeUserRole(userId, nextRole)
        .then((result) => {
          if (!result.ok) {
            setSelectedRole(previousRole);
            setError(result.message ?? "Не удалось обновить роль.");
          }
        })
        .catch((changeError) => {
          setSelectedRole(previousRole);
          setError(
            changeError instanceof Error
              ? changeError.message
              : "Не удалось обновить роль.",
          );
        });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={selectedRole}
        disabled={isPending || isCurrentUser}
        onChange={(event) => handleChange(event.target.value as Role)}
        className="h-10 min-w-[170px] rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white outline-none transition focus:border-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ROLE_OPTIONS.map((role) => (
          <option key={role} value={role} className="bg-zinc-900 text-white">
            {getRoleLabel(role)}
          </option>
        ))}
      </select>
      {isCurrentUser ? (
        <p className="text-right text-xs text-zinc-500">Свою роль менять нельзя</p>
      ) : null}
      {error ? <p className="max-w-[220px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}