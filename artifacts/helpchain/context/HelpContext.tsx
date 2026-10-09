import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { isOfflineFirestoreError } from "@/context/AuthContext";

export type HelpCategory = "emergency" | "medical" | "food" | "transport" | "daily" | "other";
export type HelpStatus = "open" | "accepted" | "completed" | "cancelled";

export interface HelpLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface HelpRequest {
  id: string;
  title: string;
  description: string;
  category: HelpCategory;
  status: HelpStatus;
  requesterId: string;
  requesterName: string;
  helperId?: string;
  helperName?: string;
  location?: HelpLocation;
  isEmergency: boolean;
  donationAmount?: number;
  createdAt: string;
  updatedAt: string;
}

interface HelpContextType {
  requests: HelpRequest[];
  loading: boolean;
  addRequest: (req: Omit<HelpRequest, "id" | "status" | "createdAt" | "updatedAt">) => Promise<HelpRequest>;
  offerHelp: (requestId: string, helperId: string, helperName: string) => Promise<void>;
  completeRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  getRequestById: (id: string) => HelpRequest | undefined;
  getEmergencyRequests: () => HelpRequest[];
  refreshRequests: () => Promise<void>;
}

const HelpContext = createContext<HelpContextType | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let snapshotUnsubscribers: (() => void)[] = [];
    let generation = 0;
    const clearSnapshots = () => {
      snapshotUnsubscribers.forEach((unsubscribe) => unsubscribe());
      snapshotUnsubscribers = [];
    };

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      const currentGeneration = ++generation;
      clearSnapshots();
      if (!fbUser) {
        setRequests([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      void (async () => {
        let isAdmin = false;
        try {
          const profile = await getDoc(doc(db, "users", fbUser.uid));
          isAdmin = profile.exists() && profile.data().isAdmin === true;
        } catch (error) {
          if (currentGeneration !== generation) return;
          console.warn("[HelpContext] could not load access profile:", error);
          setLoading(false);
          return;
        }
        if (currentGeneration !== generation) return;

        const requestsRef = collection(db, "requests");
        const queries = isAdmin
          ? [query(requestsRef, orderBy("createdAt", "desc"))]
          : [
              query(requestsRef, where("isEmergency", "==", false)),
              query(requestsRef, where("requesterId", "==", fbUser.uid)),
              query(requestsRef, where("helperId", "==", fbUser.uid)),
            ];
        const results = new Map<number, HelpRequest[]>();
        const receivedInitialSnapshots = new Set<number>();
        const publish = () => {
          const deduplicated = new Map<string, HelpRequest>();
          results.forEach((items) => items.forEach((item) => deduplicated.set(item.id, item)));
          setRequests(
            [...deduplicated.values()].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
          if (receivedInitialSnapshots.size === queries.length) setLoading(false);
        };

        queries.forEach((requestQuery, index) => {
          snapshotUnsubscribers.push(
            onSnapshot(
              requestQuery,
              (snap) => {
                if (currentGeneration !== generation) return;
                results.set(index, snap.docs.map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<HelpRequest, "id">),
                })));
                receivedInitialSnapshots.add(index);
                publish();
              },
              (error) => {
                if (currentGeneration !== generation) return;
                console.warn("[HelpContext] snapshot error:", error.code);
                receivedInitialSnapshots.add(index);
                publish();
              }
            )
          );
        });
      })();
    });
    return () => {
      generation++;
      clearSnapshots();
      unsubAuth();
    };
  }, []);

  async function addRequest(
    req: Omit<HelpRequest, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<HelpRequest> {
    if (!auth?.currentUser) {
      throw new Error("You must be signed in to create a request.");
    }

    if (auth.currentUser.uid !== req.requesterId) {
      throw new Error("Please sign in with the account you want to post from.");
    }

    const now = new Date().toISOString();
    const data = {
      ...req,
      status: "open" as HelpStatus,
      createdAt: now,
      updatedAt: now,
      _serverTs: serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(db, "requests"), data);
      // Broadcast notification to all users (fire-and-forget)
      addDoc(collection(db, "notifications"), {
        title: req.isEmergency ? "🚨 Emergency Request" : "🆕 New Help Request",
        body: `${req.requesterName} needs help: ${req.title}`,
        type: req.isEmergency ? "emergency_alert" : "new_request",
        targetUserId: req.isEmergency ? "admins" : "all",
        createdByUid: req.requesterId,
        read: false,
        requestId: ref.id,
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      }).catch(() => {});
      return { id: ref.id, ...data };
    } catch (e: any) {
      console.error("[HelpContext] addRequest failed:", e?.code, e?.message);

      if (e?.code === "permission-denied") {
        throw new Error("Permission denied. Please publish the Firestore rules and ensure you are signed in.");
      }
      if (isOfflineFirestoreError(e) || /offline|network/i.test(e?.message ?? "")) {
        throw new Error("Could not post your request because the device is offline. Please check your connection and try again.");
      }

      throw new Error(e?.message ?? "Failed to post request");
    }
  }

  async function offerHelp(requestId: string, helperId: string, helperName: string) {
    await updateDoc(doc(db, "requests", requestId), {
      status: "accepted",
      helperId,
      helperName,
      updatedAt: new Date().toISOString(),
    });
  }

  async function completeRequest(requestId: string) {
    await updateDoc(doc(db, "requests", requestId), {
      status: "completed",
      updatedAt: new Date().toISOString(),
    });
  }

  async function cancelRequest(requestId: string) {
    await updateDoc(doc(db, "requests", requestId), {
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    });
  }

  function getRequestById(id: string) {
    return requests.find((r) => r.id === id);
  }

  function getEmergencyRequests() {
    return requests.filter((r) => r.isEmergency && r.status === "open");
  }

  async function refreshRequests() {
    // No-op: onSnapshot keeps requests live
  }

  return (
    <HelpContext.Provider
      value={{
        requests,
        loading,
        addRequest,
        offerHelp,
        completeRequest,
        cancelRequest,
        getRequestById,
        getEmergencyRequests,
        refreshRequests,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used within HelpProvider");
  return ctx;
}
