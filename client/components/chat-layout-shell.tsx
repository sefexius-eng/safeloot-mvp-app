"use client";

import { usePathname } from "next/navigation";

import { ChatSidebar, type ChatSidebarConversation } from "@/components/chat-sidebar";

interface ChatLayoutShellProps {
  conversations: ChatSidebarConversation[];
  children: React.ReactNode;
}

export function ChatLayoutShell({ conversations, children }: ChatLayoutShellProps) {
  const pathname = usePathname();
  const isChatsIndex = pathname === "/chats";

  return (
    <main className="flex h-[calc(100vh-70px)] overflow-hidden bg-[#0A0D14]">
      <aside
        className={[
          "w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col bg-[#13171F]",
          isChatsIndex ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <ChatSidebar conversations={conversations} />
      </aside>

      <section
        className={[
          "flex-1 min-w-0 flex flex-col bg-[#0A0D14]",
          isChatsIndex ? "hidden md:flex" : "flex",
        ].join(" ")}
      >
        {children}
      </section>
    </main>
  );
}