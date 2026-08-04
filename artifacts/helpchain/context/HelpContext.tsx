import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

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
    // Gate on auth — prevents permission-denied on first load before login
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        setRequests([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
      const unsubSnap = onSnapshot(
        q,
        (snap) => {
          const reqs: HelpRequest[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<HelpRequest, "id">),
          }));
          setRequests(reqs);
          setLoading(false);
        },
        (err) => {
          console.warn("[HelpContext] snapshot error:", err.code);
          setLoading(false);
        }
      );
      return unsubSnap;
    });
    return () => unsubAuth();
  }, []);

  async function addRequest(
    req: Omit<HelpRequest, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<HelpRequest> {
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
        targetUserId: "all",
        createdByUid: req.requesterId,
        read: false,
        requestId: ref.id,
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      }).catch(() => {});
      return { id: ref.id, ...data };
    } catch (e: any) {
      console.error("[HelpContext] addRequest failed:", e?.code, e?.message);
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
