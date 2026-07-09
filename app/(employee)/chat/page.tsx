"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { ChatClient } from "@/components/chat/ChatClient";

export default function ChatPage() {
  const { id, fullName, canChat, avatarUrl, department } = useCurrentUser();
  return (
    <div className="mx-auto max-w-2xl">
      <ChatClient
        uid={id}
        userName={fullName ?? "You"}
        canChat={canChat}
        userAvatar={avatarUrl}
        department={department}
      />
    </div>
  );
}
