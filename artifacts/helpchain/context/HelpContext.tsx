import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

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
const REQUESTS_KEY = "@helpchain_requests";

const SEED_REQUESTS: HelpRequest[] = [
  {
    id: "r1",
    title: "Need help carrying groceries",
    description: "I'm an elderly resident and need help carrying groceries from the store 2 blocks away. Won't take more than 20 minutes.",
    category: "food",
    status: "open",
    requesterId: "u1",
    requesterName: "John Smith",
    isEmergency: false,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "r2",
    title: "URGENT: Medical assistance needed",
    description: "Person collapsed near Riverside Park. Please send help immediately. Need first aid until ambulance arrives.",
    category: "emergency",
    status: "open",
    requesterId: "u2",
    requesterName: "Jane Doe",
    isEmergency: true,
    location: { latitude: 40.7128, longitude: -74.006, address: "Riverside Park, North Entrance" },
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "r3",
    title: "Need a ride to hospital appointment",
    description: "I have a doctor's appointment tomorrow at 10am at City Hospital. Need a ride from 5th Avenue. Can offer fuel money.",
    category: "transport",
    status: "accepted",
    requesterId: "u2",
    requesterName: "Jane Doe",
    helperId: "u1",
    helperName: "John Smith",
    isEmergency: false,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "r4",
    title: "Help with home repairs after storm",
    description: "Storm damage caused some roof tiles to fall. Need help patching up or finding a contractor. Can anyone assist?",
    category: "daily",
    status: "open",
    requesterId: "u1",
    requesterName: "John Smith",
    isEmergency: false,
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "r5",
    title: "Lost dog - please help find",
    description: "My golden retriever went missing near Oak Street. He's friendly and wearing a red collar. Name: Buddy. Please call if found.",
    category: "other",
    status: "completed",
    requesterId: "u2",
    requesterName: "Jane Doe",
    helperId: "u0",
    helperName: "Admin User",
    isEmergency: false,
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const stored = await AsyncStorage.getItem(REQUESTS_KEY);
      if (stored) {
        setRequests(JSON.parse(stored));
      } else {
        setRequests(SEED_REQUESTS);
        await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(SEED_REQUESTS));
      }
    } catch (e) {
      setRequests(SEED_REQUESTS);
    } finally {
      setLoading(false);
    }
  }

  async function refreshRequests() {
    const stored = await AsyncStorage.getItem(REQUESTS_KEY);
    if (stored) setRequests(JSON.parse(stored));
  }

  async function saveRequests(updated: HelpRequest[]) {
    setRequests(updated);
    await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
  }

  async function addRequest(req: Omit<HelpRequest, "id" | "status" | "createdAt" | "updatedAt">): Promise<HelpRequest> {
    const now = new Date().toISOString();
    const newReq: HelpRequest = {
      ...req,
      id: "r" + Date.now(),
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    await saveRequests([newReq, ...requests]);
    return newReq;
  }

  async function offerHelp(requestId: string, helperId: string, helperName: string) {
    const updated = requests.map((r) =>
      r.id === requestId ? { ...r, status: "accepted" as HelpStatus, helperId, helperName, updatedAt: new Date().toISOString() } : r
    );
    await saveRequests(updated);
  }

  async function completeRequest(requestId: string) {
    const updated = requests.map((r) =>
      r.id === requestId ? { ...r, status: "completed" as HelpStatus, updatedAt: new Date().toISOString() } : r
    );
    await saveRequests(updated);
  }

  async function cancelRequest(requestId: string) {
    const updated = requests.map((r) =>
      r.id === requestId ? { ...r, status: "cancelled" as HelpStatus, updatedAt: new Date().toISOString() } : r
    );
    await saveRequests(updated);
  }

  function getRequestById(id: string) {
    return requests.find((r) => r.id === id);
  }

  function getEmergencyRequests() {
    return requests.filter((r) => r.isEmergency && r.status === "open");
  }

  return (
    <HelpContext.Provider
      value={{ requests, loading, addRequest, offerHelp, completeRequest, cancelRequest, getRequestById, getEmergencyRequests, refreshRequests }}
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
