"use client";

import { ChatManagement } from "@/components/admin/ChatManagement";

export default function AdminChatPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">Chat management</h1>
        <p className="text-sm text-gray-500">
          Grant or revoke access to the team chat per person.
        </p>
      </div>
      <ChatManagement />
    </div>
  );
}
