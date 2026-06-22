import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

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
const DONATIONS_KEY = "@helpchain_donations_v2";

const SEED_DONATIONS: Donation[] = [
  {
    id: "d1",
    donorId: "u1",
    donorName: "John Smith",
    itemType: "Food",
    itemIcon: "shopping-bag",
    quantity: 5,
    description: "Rice, lentils and canned goods",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "d2",
    donorId: "u2",
    donorName: "Jane Doe",
    itemType: "Clothes",
    itemIcon: "tag",
    quantity: 3,
    description: "Winter jackets and children's clothes",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "d3",
    donorId: "u1",
    donorName: "John Smith",
    itemType: "Medicine",
    itemIcon: "heart",
    quantity: 10,
    description: "First aid kits and vitamins",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "d4",
    donorId: "u2",
    donorName: "Jane Doe",
    itemType: "Books",
    itemIcon: "book-open",
    quantity: 8,
    description: "Children's books and school supplies",
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

  async function addDonation(
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string
  ) {
    const donation: Donation = {
      id: "d" + Date.now(),
      donorId,
      donorName,
      itemType,
      itemIcon,
      quantity,
      description,
      createdAt: new Date().toISOString(),
    };
    const updated = [donation, ...donations];
    setDonations(updated);
    await AsyncStorage.setItem(DONATIONS_KEY, JSON.stringify(updated));
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
