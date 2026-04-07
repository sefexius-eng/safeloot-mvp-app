"use client";

import type { Role } from "@prisma/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { searchUsers, type SearchUserResult } from "@/app/actions/search";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getRoleLabel, isTeamRole } from "@/lib/roles";

const SEARCH_DEBOUNCE_MS = 250;

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getRoleBadgeVariant(role: Role) {
  switch (role) {
    case "MODERATOR":
      return "info" as const;
    case "ADMIN":
      return "warning" as const;
    case "SUPER_ADMIN":
      return "destructive" as const;
    case "USER":
    default:
      return "secondary" as const;
  }
}

export function UserSearchDialog({ open, onOpenChange }: UserSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setErrorMessage("");
      return;
    }

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      setErrorMessage("");
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        setErrorMessage("");
        const nextResults = await searchUsers(query);

        if (isActive) {
          setResults(nextResults);
        }
      } catch (error) {
        if (isActive) {
          setResults([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось выполнить поиск пользователей.",
          );
        }
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [open, query]);

  function handleSelectUser(user: SearchUserResult) {
    onOpenChange(false);
    router.push(`/profile/${user.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.2),transparent_34%),rgba(9,9,11,0.96)] px-6 py-6 sm:px-7">
          <DialogHeader className="space-y-3 pr-10">
            <DialogTitle>Найти пользователя</DialogTitle>
            <DialogDescription>
              Поиск идет только по таблице пользователей. Можно искать по никнейму или email.
            </DialogDescription>
          </DialogHeader>

          <label className="mt-5 block">
            <span className="sr-only">Поиск пользователя</span>
            <input
              type="search"
              value={query}
              autoFocus
              onChange={(event) => {
                setQuery(event.target.value);
                setErrorMessage("");
              }}
              placeholder="Введите никнейм или email"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.22)] outline-none transition placeholder:text-zinc-500 focus:border-orange-500/40 focus:bg-white/8 focus:ring-4 focus:ring-orange-500/10"
            />
          </label>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-3 py-3">
          {!query.trim() ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-7 text-zinc-400">
              Начните вводить имя пользователя или email, чтобы открыть его публичный профиль.
            </div>
          ) : isSearching ? (
            <div className="px-3 py-4 text-sm text-zinc-400">Ищем пользователей...</div>
          ) : errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm leading-7 text-red-200">
              {errorMessage}
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-zinc-400">Пользователи не найдены.</div>
          ) : (
            <div className="space-y-2">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="flex w-full items-center gap-4 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <UserAvatar
                    src={user.image}
                    name={user.name}
                    email={user.email}
                    className="h-12 w-12 shrink-0 rounded-2xl border-white/10 bg-zinc-800/80"
                    imageClassName="rounded-2xl object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">
                        {user.name}
                      </span>
                      {isTeamRole(user.role) ? (
                        <Badge
                          variant={getRoleBadgeVariant(user.role)}
                          className="px-2 py-0.5 text-[10px] tracking-[0.14em]"
                        >
                          {getRoleLabel(user.role)}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-sm text-zinc-400">
                      {user.email}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}