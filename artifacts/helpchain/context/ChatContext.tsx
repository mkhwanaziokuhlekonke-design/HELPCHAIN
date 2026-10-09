import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

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
  error: string | null;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) {
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "chat"), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        const msgs: ChatMessage[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, "id">),
        }));
        setMessages(msgs);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("[ChatContext] snapshot error:", err.code, err.message);
        setError(err.code === "permission-denied" ? "permission-denied" : "unavailable");
        setLoading(false);
      }
    );
  }, [authLoading, user?.id, user?.isAdmin]);

  async function sendMessage(userId: string, userName: string, text: string) {
    try {
      await addDoc(collection(db, "chat"), {
        userId,
        userName,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      });
    } catch (e: any) {
      console.error("[ChatContext] sendMessage failed:", e?.code, e?.message);
      throw new Error(e?.code ?? "send-failed");
    }
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage, loading, error }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
