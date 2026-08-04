import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for an authenticated user before opening the listener.
    // This prevents a permission-denied error on mount (before login)
    // that would kill the listener and never restart it.
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        // Not signed in — clear state but don't open a doomed listener
        setMessages([]);
        setLoading(false);
        return;
      }

      // Signed in — open (or re-open) the real-time listener
      setLoading(true);
      const q = query(collection(db, "chat"), orderBy("createdAt", "asc"));
      const unsubSnap = onSnapshot(
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

      // When auth state changes (e.g. sign-out), tear down the snapshot listener
      return unsubSnap;
    });

    return () => unsubAuth();
  }, []);

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
