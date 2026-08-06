/**
 * PresenceContext — real-time per-user presence (WhatsApp-style).
 *
 * Each user writes presence/{uid} on login and refreshes every 30 s.
 * The listener builds a map so any screen can check isOnline(uid) or
 * call lastSeenText(uid) to get "online", "last seen 2 min ago", etc.
 */
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { auth, db } from "@/lib/firebase";

const ACTIVE_WINDOW_MS = 3 * 60 * 1000;  // 3 min → counts as "online"
const HEARTBEAT_MS     = 30 * 1000;       // pulse every 30 s

export interface PresenceEntry {
  uid: string;
  name: string;
  online: boolean;       // explicitly set by the client
  lastSeenMs: number;    // resolved to milliseconds
}

interface PresenceContextType {
  activeCount: number;
  presenceMap: Record<string, PresenceEntry>;
  isOnline: (uid: string) => boolean;
  lastSeenText: (uid: string) => string;
}

const PresenceContext = createContext<PresenceContextType>({
  activeCount: 0,
  presenceMap: {},
  isOnline: () => false,
  lastSeenText: () => "",
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceEntry>>({});
  const [activeCount, setActiveCount] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uidRef = useRef<string | null>(null);

  // ── write / refresh presence ──────────────────────────────────────────
  const touchPresence = useCallback(async (uid: string, name: string, online: boolean) => {
    try {
      await setDoc(
        doc(db, "presence", uid),
        { uid, name, lastSeen: serverTimestamp(), online },
        { merge: true }
      );
    } catch { /* non-critical */ }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((uid: string, name: string) => {
    stopHeartbeat();
    touchPresence(uid, name, true);
    heartbeatRef.current = setInterval(() => touchPresence(uid, name, true), HEARTBEAT_MS);
  }, [touchPresence, stopHeartbeat]);

  // ── auth gate ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        uidRef.current = fbUser.uid;
        const name = fbUser.displayName ?? fbUser.email?.split("@")[0] ?? "User";
        startHeartbeat(fbUser.uid, name);
      } else {
        if (uidRef.current) {
          updateDoc(doc(db, "presence", uidRef.current), { online: false }).catch(() => {});
        }
        uidRef.current = null;
        stopHeartbeat();
        setPresenceMap({});
        setActiveCount(0);
      }
    });
    return () => { unsubAuth(); stopHeartbeat(); };
  }, [startHeartbeat, stopHeartbeat]);

  // ── app background / foreground ───────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (!uidRef.current) return;
      const name = auth.currentUser?.displayName ?? auth.currentUser?.email?.split("@")[0] ?? "User";
      if (state === "active") {
        startHeartbeat(uidRef.current, name);
      } else {
        stopHeartbeat();
        // write one final lastSeen so the window expires naturally
        updateDoc(doc(db, "presence", uidRef.current), {
          online: false,
          lastSeen: serverTimestamp(),
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [startHeartbeat, stopHeartbeat]);

  // ── live listener → build presenceMap ────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "presence"),
      (snap) => {
        const now = Date.now();
        const cutoff = now - ACTIVE_WINDOW_MS;
        const map: Record<string, PresenceEntry> = {};
        let count = 0;

        snap.docs.forEach((d) => {
          const data = d.data();
          let ms = 0;
          if (data.lastSeen?.toMillis) ms = data.lastSeen.toMillis();
          else if (typeof data.lastSeen === "string") ms = new Date(data.lastSeen).getTime();

          const isRecent = ms > cutoff;
          const entry: PresenceEntry = {
            uid: d.id,
            name: data.name ?? "User",
            online: data.online === true && isRecent,
            lastSeenMs: ms,
          };
          map[d.id] = entry;
          if (isRecent) count++;
        });

        setPresenceMap(map);
        setActiveCount(count);
      },
      () => { /* rules not yet published — silent */ }
    );
    return () => unsub();
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────
  const isOnline = useCallback(
    (uid: string) => presenceMap[uid]?.online === true,
    [presenceMap]
  );

  const lastSeenText = useCallback(
    (uid: string): string => {
      const entry = presenceMap[uid];
      if (!entry) return "";
      if (entry.online) return "online";
      const diffMs = Date.now() - entry.lastSeenMs;
      if (diffMs < 60_000) return "last seen just now";
      const mins = Math.floor(diffMs / 60_000);
      if (mins < 60) return `last seen ${mins} min ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `last seen ${hrs}h ago`;
      return `last seen ${Math.floor(hrs / 24)}d ago`;
    },
    [presenceMap]
  );

  return (
    <PresenceContext.Provider value={{ activeCount, presenceMap, isOnline, lastSeenText }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
