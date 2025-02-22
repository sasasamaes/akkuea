'use client';

import type React from 'react';

import { useMessages } from '../../store/messaging-store';
import { Send, Smile, ImageIcon, X } from 'lucide-react';
import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EmojiClickData } from 'emoji-picker-react';
import { Avatar } from './Avatar';
import Image from 'next/image';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function MessageInput() {
  const { selectedConversationId, addMessage, setTypingStatus, conversations } = useMessages();
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !selectedConversationId) return;

    let mediaUrl = null;
    let linkPreview = null;

    // Handle media upload
    if (mediaFile) {
      // In a real application, you would upload the file to a server here
      // and get back a URL. For this example, we'll use a data URL.
      mediaUrl = mediaPreview;
    }

    // Simple link detection (you might want to use a more robust solution)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = newMessage.match(urlRegex);

    if (urls && urls.length > 0) {
      // In a real application, you would call an API to get the link preview
      // For this example, we'll simulate it with a timeout
      linkPreview = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            url: urls[0],
            title: 'Example Link Title',
            description: 'This is an example link description.',
            image: 'https://via.placeholder.com/300x200',
          });
        }, 500);
      });
    }

    addMessage(selectedConversationId, {
      content: newMessage,
      sender: 'You',
      type: 'sent',
      read: true,
      mediaUrl,
      linkPreview,
    });

    setNewMessage('');
    setMediaFile(null);
    setMediaPreview(null);
    setError(null);

    // Simulate received message with the selected contact's name
    setTimeout(() => {
      const selectedConversation = conversations.find((conv) => conv.id === selectedConversationId);
      if (selectedConversation) {
        addMessage(selectedConversationId, {
          content: `Thanks for your message! This is ${selectedConversation.name} responding.`,
          sender: selectedConversation.name,
          type: 'received',
          read: false,
        });
      }
    }, 1000);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (selectedConversationId) {
      setTypingStatus(selectedConversationId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedConversationId) {
        setTypingStatus(selectedConversationId, false);
      }
    }, 1000);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError('File size exceeds 5MB limit.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        return;
      }

      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 border-t">
      {error && <div className="mb-2 text-red-500 text-sm">{error}</div>}
      {mediaPreview && (
        <div className="mb-2 relative">
          <Image
            src={mediaPreview || '/placeholder.svg'}
            alt="Media preview"
            width={300}
            height={200}
            className="max-h-32 rounded-lg object-cover"
          />
          <button
            onClick={removeMedia}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
        <Avatar name="You" size="sm" />
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleTyping}
            className="w-full px-3 py-2 text-sm leading-5 text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-10">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <ImageIcon className="h-5 w-5" />
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-500 border border-transparent rounded-md hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </button>
      </form>
    </div>
  );
}
