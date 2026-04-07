"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";

import { SellVerificationGateCard } from "@/components/sell/sell-verification-blocker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SellAccessLinkProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function SellAccessLink({
  children,
  className,
  ariaLabel,
}: SellAccessLinkProps) {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const shouldBlockSellAccess =
    status === "authenticated" &&
    !session.user.isBanned &&
    !session.user.emailVerified;

  if (!shouldBlockSellAccess) {
    return (
      <Link href="/sell" className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn("appearance-none border-0 bg-transparent p-0 text-left", className)}
        aria-label={ariaLabel}
      >
        {children}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl border-none bg-transparent p-0 shadow-none">
          <SellVerificationGateCard
            email={session.user.email ?? "ваш email"}
            mode="dialog"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}