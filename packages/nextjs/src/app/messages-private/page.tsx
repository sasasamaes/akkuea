'use client';

import { ConversationList } from '../../components/messages/ConversationList';
import { MessageThread } from '../../components/messages/MessageThread';
import { MessageInput } from '../../components/messages/MessageInput';
import { useState } from 'react';
import { Menu } from 'lucide-react';

export default function MessagesPage() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile sidebar toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Conversation list sidebar */}
      <div
        className={`${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transform transition-transform duration-300 ease-in-out lg:static fixed inset-y-0 left-0 z-40 w-full max-w-xs bg-white border-r`}
      >
        <ConversationList onSelectConversation={() => setShowSidebar(false)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <MessageThread />
        <MessageInput />
      </div>
    </div>
  );
}
