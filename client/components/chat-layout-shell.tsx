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
    <main className="flex h-[calc(100vh-70px)] overflow-hidden bg-[#0b0e14]">
      <aside
        className={[
          "w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col bg-[linear-gradient(180deg,rgba(13,17,23,0.98),rgba(10,13,18,0.98))]",
          isChatsIndex ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <ChatSidebar conversations={conversations} />
      </aside>

      <section
        className={[
          "flex-1 min-w-0 flex flex-col bg-[radial-gradient(circle_at_top_left,rgba(0,200,83,0.08),transparent_36%),linear-gradient(180deg,rgba(13,17,23,0.94),rgba(11,14,20,0.92))]",
          isChatsIndex ? "hidden md:flex" : "flex",
        ].join(" ")}
      >
        {children}
      </section>
    </main>
  );
}