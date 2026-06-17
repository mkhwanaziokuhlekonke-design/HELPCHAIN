import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (userId: string, userName: string, text: string) => Promise<void>;
  loading: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);
const CHAT_KEY = "@helpchain_chat";

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: "c1",
    userId: "u0",
    userName: "Admin User",
    text: "Welcome to HelpChain Community Chat! Please be respectful and kind to one another.",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "c2",
    userId: "u1",
    userName: "John Smith",
    text: "Hi everyone! Happy to help anyone who needs assistance this week.",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "c3",
    userId: "u2",
    userName: "Jane Doe",
    text: "Great community here! Got help with my grocery run. Thank you so much!",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "c4",
    userId: "u1",
    userName: "John Smith",
    text: "Does anyone know of any food banks open this weekend?",
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "c5",
    userId: "u0",
    userName: "Admin User",
    text: "Check the Requests tab for the latest open help requests in your area!",
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
];

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    try {
      const stored = await AsyncStorage.getItem(CHAT_KEY);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages(SEED_MESSAGES);
        await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(SEED_MESSAGES));
      }
    } catch {
      setMessages(SEED_MESSAGES);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(userId: string, userName: string, text: string) {
    const msg: ChatMessage = {
      id: "c" + Date.now(),
      userId,
      userName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...messages, msg];
    setMessages(updated);
    await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(updated));
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage, loading }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
