import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  amount: number;
  message?: string;
  createdAt: string;
}

interface DonationContextType {
  donations: Donation[];
  addDonation: (donorId: string, donorName: string, amount: number, message?: string) => Promise<void>;
  totalRaised: number;
}

const DonationContext = createContext<DonationContextType | null>(null);
const DONATIONS_KEY = "@helpchain_donations";

const SEED_DONATIONS: Donation[] = [
  {
    id: "d1",
    donorId: "u1",
    donorName: "John Smith",
    amount: 25,
    message: "Happy to support the community!",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "d2",
    donorId: "u2",
    donorName: "Jane Doe",
    amount: 10,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "d3",
    donorId: "u1",
    donorName: "John Smith",
    amount: 50,
    message: "Keep up the great work!",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "d4",
    donorId: "u2",
    donorName: "Jane Doe",
    amount: 5,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

export function DonationProvider({ children }: { children: React.ReactNode }) {
  const [donations, setDonations] = useState<Donation[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DONATIONS_KEY);
        if (stored) {
          setDonations(JSON.parse(stored));
        } else {
          setDonations(SEED_DONATIONS);
          await AsyncStorage.setItem(DONATIONS_KEY, JSON.stringify(SEED_DONATIONS));
        }
      } catch {
        setDonations(SEED_DONATIONS);
      }
    })();
  }, []);

  async function addDonation(donorId: string, donorName: string, amount: number, message?: string) {
    const donation: Donation = {
      id: "d" + Date.now(),
      donorId,
      donorName,
      amount,
      message,
      createdAt: new Date().toISOString(),
    };
    const updated = [donation, ...donations];
    setDonations(updated);
    await AsyncStorage.setItem(DONATIONS_KEY, JSON.stringify(updated));
  }

  const totalRaised = donations.reduce((sum, d) => sum + d.amount, 0);

  return (
    <DonationContext.Provider value={{ donations, addDonation, totalRaised }}>
      {children}
    </DonationContext.Provider>
  );
}

export function useDonations() {
  const ctx = useContext(DonationContext);
  if (!ctx) throw new Error("useDonations must be used within DonationProvider");
  return ctx;
}
