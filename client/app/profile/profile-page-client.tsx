"use client";

import { useState } from "react";

import { ProfileDashboard } from "@/components/profile/profile-dashboard";
import { WithdrawalPanel } from "@/components/profile/withdrawal-panel";
import type { WithdrawalListItem } from "@/lib/withdrawals";

interface ProfilePageClientProps {
  isAuthenticated: boolean;
  availableBalance: string;
  withdrawals: WithdrawalListItem[];
}

export function ProfilePageClient({
  isAuthenticated,
  availableBalance,
  withdrawals,
}: ProfilePageClientProps) {
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  return (
    <>
      <ProfileDashboard />
      <WithdrawalPanel
        isAuthenticated={isAuthenticated}
        availableBalance={availableBalance}
        withdrawals={withdrawals}
        isModalOpen={isWithdrawModalOpen}
        onOpenChange={setIsWithdrawModalOpen}
      />
    </>
  );
}