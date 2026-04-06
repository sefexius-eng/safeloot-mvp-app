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
    <main className="flex h-[calc(100vh-70px)] overflow-hidden">
      <aside
        className={[
          "w-full md:w-80 lg:w-96 border-r border-gray-800 flex flex-col bg-[#0f1117]",
          isChatsIndex ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <ChatSidebar conversations={conversations} />
      </aside>

      <section
        className={[
          "flex-1 flex flex-col bg-gray-900/30 min-w-0",
          isChatsIndex ? "hidden md:flex" : "flex",
        ].join(" ")}
      >
        {children}
      </section>
    </main>
  );
}