import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type NotifType = "help_accepted" | "help_offered" | "emergency_alert" | "completed" | "system";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  read: boolean;
  requestId?: string;
  createdAt: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "read" | "createdAt">) => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);
const NOTIFS_KEY = "@helpchain_notifications";

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    title: "Emergency Alert",
    body: "A new emergency help request was posted near your area.",
    type: "emergency_alert",
    read: false,
    requestId: "r2",
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "n2",
    title: "Help Offer Accepted",
    body: "John Smith accepted your transport request to the hospital.",
    type: "help_accepted",
    read: false,
    requestId: "r3",
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "n3",
    title: "Welcome to HelpChain!",
    body: "You're now part of a community that helps each other. Start by browsing open requests or posting your own.",
    type: "system",
    read: true,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const stored = await AsyncStorage.getItem(NOTIFS_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications(SEED_NOTIFICATIONS);
        await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify(SEED_NOTIFICATIONS));
      }
    } catch {
      setNotifications(SEED_NOTIFICATIONS);
    }
  }

  async function save(updated: AppNotification[]) {
    setNotifications(updated);
    await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify(updated));
  }

  async function addNotification(n: Omit<AppNotification, "id" | "read" | "createdAt">) {
    const newN: AppNotification = {
      ...n,
      id: "n" + Date.now(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    await save([newN, ...notifications]);
  }

  async function markRead(id: string) {
    await save(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    await save(notifications.map((n) => ({ ...n, read: true })));
  }

  async function clearAll() {
    await save([]);
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
