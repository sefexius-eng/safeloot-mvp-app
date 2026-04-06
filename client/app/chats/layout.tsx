import { redirect } from "next/navigation";

import { ChatLayoutShell } from "@/components/chat-layout-shell";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { listConversationsByUser } from "@/lib/marketplace";

interface ChatsLayoutProps {
  children: React.ReactNode;
}

export default async function ChatsLayout({ children }: ChatsLayoutProps) {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.isBanned) {
    redirect("/");
  }

  const conversations = await listConversationsByUser(currentUser.id);

  return <ChatLayoutShell conversations={conversations}>{children}</ChatLayoutShell>;
}