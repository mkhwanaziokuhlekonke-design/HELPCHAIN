import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

export type NotifType = "help_accepted" | "help_offered" | "emergency_alert" | "completed" | "system";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  read: boolean;
  requestId?: string;
  createdAt: string;
  /** "all" = broadcast to every user; otherwise a specific uid */
  targetUserId: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "read" | "createdAt" | "targetUserId"> & { targetUserId?: string }) => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  // Track auth state so we know which user's notifications to load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setCurrentUid(fbUser?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // Subscribe to Firestore notifications for this user + broadcasts
  useEffect(() => {
    if (!currentUid) {
      setNotifications([]);
      return;
    }

    // Query: notifications targeted at this user OR broadcast to "all"
    const q = query(
      collection(db, "notifications"),
      where("targetUserId", "in", [currentUid, "all"]),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: AppNotification[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppNotification, "id">),
        }));
        setNotifications(items);
      },
      (err) => console.warn("[NotificationContext] snapshot error:", err.code)
    );
    return () => unsub();
  }, [currentUid]);

  async function addNotification(
    n: Omit<AppNotification, "id" | "read" | "createdAt" | "targetUserId"> & { targetUserId?: string }
  ) {
    try {
      await addDoc(collection(db, "notifications"), {
        ...n,
        targetUserId: n.targetUserId ?? (n.type === "emergency_alert" ? "all" : currentUid ?? "all"),
        read: false,
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      });
    } catch (e: any) {
      console.warn("[NotificationContext] addNotification failed:", e?.code);
    }
  }

  async function markRead(id: string) {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (e: any) {
      console.warn("[NotificationContext] markRead failed:", e?.code);
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
      await batch.commit();
    } catch (e: any) {
      console.warn("[NotificationContext] markAllRead failed:", e?.code);
    }
  }

  async function clearAll() {
    if (!notifications.length) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => batch.delete(doc(db, "notifications", n.id)));
      await batch.commit();
    } catch (e: any) {
      console.warn("[NotificationContext] clearAll failed:", e?.code);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, markRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
