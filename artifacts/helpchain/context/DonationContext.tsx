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

export interface DonationLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  itemType: string;
  itemIcon: string;
  quantity: number;
  description?: string;
  createdAt: string;
  /** GPS position of the donor at the time of donation (optional — only set when permission granted) */
  location?: DonationLocation;
}

interface DonationContextType {
  donations: Donation[];
  addDonation: (
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string,
    location?: DonationLocation
  ) => Promise<void>;
  totalItems: number;
}

const DonationContext = createContext<DonationContextType | null>(null);

export function DonationProvider({ children }: { children: React.ReactNode }) {
  const [donations, setDonations] = useState<Donation[]>([]);

  useEffect(() => {
    // Gate on auth — prevents permission-denied on first load before login
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        setDonations([]);
        return;
      }
      const q = query(collection(db, "donations"), orderBy("createdAt", "desc"));
      const unsubSnap = onSnapshot(
        q,
        (snap) => {
          const items: Donation[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Donation, "id">),
          }));
          setDonations(items);
        },
        (err) => console.warn("[DonationContext] snapshot error:", err.code)
      );
      return unsubSnap;
    });
    return () => unsubAuth();
  }, []);

  async function addDonation(
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string,
    location?: DonationLocation
  ) {
    try {
      await addDoc(collection(db, "donations"), {
        donorId,
        donorName,
        itemType,
        itemIcon,
        quantity,
        description: description ?? "",
        ...(location ? { location } : {}),
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      });
      // Broadcast notification to all users (fire-and-forget)
      addDoc(collection(db, "notifications"), {
        title: "🎁 New Donation",
        body: `${donorName} donated ${quantity} ${itemType} item${quantity !== 1 ? "s" : ""}${description ? ` — ${description}` : ""}`,
        type: "new_donation",
        targetUserId: "all",
        createdByUid: donorId,
        read: false,
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      }).catch(() => {});
    } catch (e: any) {
      console.error("[DonationContext] addDonation failed:", e?.code, e?.message);
      throw new Error(e?.message ?? "Failed to submit donation");
    }
  }

  const totalItems = donations.reduce((sum, d) => sum + d.quantity, 0);

  return (
    <DonationContext.Provider value={{ donations, addDonation, totalItems }}>
      {children}
    </DonationContext.Provider>
  );
}

export function useDonations() {
  const ctx = useContext(DonationContext);
  if (!ctx) throw new Error("useDonations must be used within DonationProvider");
  return ctx;
}
