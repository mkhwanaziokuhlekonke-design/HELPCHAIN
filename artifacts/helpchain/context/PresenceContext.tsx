/**
 * PresenceContext — real-time active user count.
 *
 * How it works:
 *  • On login: writes presence/{uid} with lastSeen = now, online = true
 *  • Every 60 s: updates lastSeen so the doc stays fresh
 *  • On logout / unmount: marks online = false
 *  • Listener: watches the whole presence collection and counts docs
 *    whose lastSeen is within the last 5 minutes (client-side filter)
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

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_MS = 60 * 1000;          // 1 minute

interface PresenceContextType {
  activeCount: number;
}

const PresenceContext = createContext<PresenceContextType>({ activeCount: 0 });

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uidRef = useRef<string | null>(null);

  // ── write / refresh this user's presence ──────────────────────────────
  const touchPresence = useCallback(
    async (uid: string, name: string, online: boolean) => {
      try {
        await setDoc(
          doc(db, "presence", uid),
          { uid, name, lastSeen: serverTimestamp(), online },
          { merge: true }
        );
      } catch {
        // silently ignore — not critical
      }
    },
    []
  );

  const startHeartbeat = useCallback(
    (uid: string, name: string) => {
      stopHeartbeat();
      touchPresence(uid, name, true);
      heartbeatRef.current = setInterval(
        () => touchPresence(uid, name, true),
        HEARTBEAT_MS
      );
    },
    [touchPresence]
  );

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // ── auth gate ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        uidRef.current = fbUser.uid;
        const name = fbUser.displayName ?? fbUser.email?.split("@")[0] ?? "User";
        startHeartbeat(fbUser.uid, name);
      } else {
        if (uidRef.current) {
          // mark offline on sign-out
          updateDoc(doc(db, "presence", uidRef.current), { online: false }).catch(
            () => {}
          );
        }
        uidRef.current = null;
        stopHeartbeat();
        setActiveCount(0);
      }
    });

    return () => {
      unsubAuth();
      stopHeartbeat();
    };
  }, [startHeartbeat, stopHeartbeat]);

  // ── pause heartbeat when app goes to background ───────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (!uidRef.current) return;
      if (state === "active") {
        const name = auth.currentUser?.displayName ??
          auth.currentUser?.email?.split("@")[0] ?? "User";
        startHeartbeat(uidRef.current, name);
      } else {
        stopHeartbeat();
        // mark lastSeen so the window expires naturally while backgrounded
        updateDoc(doc(db, "presence", uidRef.current), {
          lastSeen: serverTimestamp(),
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [startHeartbeat, stopHeartbeat]);

  // ── listen to presence collection & count active ──────────────────────
  useEffect(() => {
    const unsubSnap = onSnapshot(
      collection(db, "presence"),
      (snap) => {
        const cutoff = Date.now() - ACTIVE_WINDOW_MS;
        let count = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          // lastSeen can be a Firestore Timestamp or ISO string
          let ms: number | null = null;
          if (data.lastSeen?.toMillis) {
            ms = data.lastSeen.toMillis();
          } else if (typeof data.lastSeen === "string") {
            ms = new Date(data.lastSeen).getTime();
          }
          if (ms !== null && ms > cutoff) count++;
        });
        setActiveCount(count);
      },
      () => {
        // rules not yet updated — fail silently
      }
    );
    return () => unsubSnap();
  }, []);

  return (
    <PresenceContext.Provider value={{ activeCount }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
