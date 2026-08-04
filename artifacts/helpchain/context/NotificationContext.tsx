import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";

export type NotifType =
  | "help_accepted"
  | "help_offered"
  | "emergency_alert"
  | "completed"
  | "new_request"
  | "new_donation"
  | "system";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  read: boolean;
  requestId?: string;
  createdAt: string;
  /** "all" = broadcast; otherwise a specific uid */
  targetUserId: string;
  /** uid of whoever created this notification — used to skip self-toasts */
  createdByUid?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  /** Most recent notification that arrived after initial load, not sent by current user */
  latestArrival: AppNotification | null;
  dismissArrival: () => void;
  addNotification: (
    n: Omit<AppNotification, "id" | "read" | "createdAt" | "targetUserId"> & {
      targetUserId?: string;
    }
  ) => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [latestArrival, setLatestArrival] = useState<AppNotification | null>(null);

  // Refs for new-arrival detection
  const isInitialLoadRef = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setCurrentUid(fbUser?.uid ?? null);
      if (!fbUser) {
        // Reset on sign-out so next sign-in gets a fresh initial load
        isInitialLoadRef.current = true;
        knownIdsRef.current = new Set();
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Firestore — query without orderBy to avoid composite index requirement;
  // we sort client-side instead.
  useEffect(() => {
    if (!currentUid) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("targetUserId", "in", [currentUid, "all"])
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: AppNotification[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) }))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        if (isInitialLoadRef.current) {
          // Record all existing IDs — don't toast for these
          snap.docs.forEach((d) => knownIdsRef.current.add(d.id));
          isInitialLoadRef.current = false;
        } else {
          // Find docs that arrived after the initial load
          const added = snap
            .docChanges()
            .filter((c) => c.type === "added" && !knownIdsRef.current.has(c.doc.id));

          added.forEach((c) => knownIdsRef.current.add(c.doc.id));

          if (added.length > 0) {
            // Pick the newest new notification
            const newest = added
              .map((c) => ({
                id: c.doc.id,
                ...(c.doc.data() as Omit<AppNotification, "id">),
              }))
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0];

            // Skip toasting for notifications the current user wrote themselves
            if (newest.createdByUid !== currentUid) {
              setLatestArrival(newest);
            }
          }
        }

        setNotifications(items);
      },
      (err) => console.warn("[NotificationContext] snapshot error:", err.code)
    );

    return () => {
      unsub();
      isInitialLoadRef.current = true;
      knownIdsRef.current = new Set();
    };
  }, [currentUid]);

  function dismissArrival() {
    setLatestArrival(null);
  }

  async function addNotification(
    n: Omit<AppNotification, "id" | "read" | "createdAt" | "targetUserId"> & {
      targetUserId?: string;
    }
  ) {
    try {
      await addDoc(collection(db, "notifications"), {
        ...n,
        targetUserId:
          n.targetUserId ??
          (n.type === "emergency_alert" ? "all" : currentUid ?? "all"),
        createdByUid: currentUid ?? "",
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
      unread.forEach((n) =>
        batch.update(doc(db, "notifications", n.id), { read: true })
      );
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
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        latestArrival,
        dismissArrival,
        addNotification,
        markAllRead,
        markRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
