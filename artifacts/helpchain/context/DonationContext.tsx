import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  itemType: string;
  itemIcon: string;
  quantity: number;
  description?: string;
  createdAt: string;
}

interface DonationContextType {
  donations: Donation[];
  addDonation: (
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string
  ) => Promise<void>;
  totalItems: number;
}

const DonationContext = createContext<DonationContextType | null>(null);

export function DonationProvider({ children }: { children: React.ReactNode }) {
  const [donations, setDonations] = useState<Donation[]>([]);

  useEffect(() => {
    const q = query(collection(db, "donations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
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
    return () => unsub();
  }, []);

  async function addDonation(
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string
  ) {
    try {
      await addDoc(collection(db, "donations"), {
        donorId,
        donorName,
        itemType,
        itemIcon,
        quantity,
        description: description ?? "",
        createdAt: new Date().toISOString(),
        _serverTs: serverTimestamp(),
      });
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
