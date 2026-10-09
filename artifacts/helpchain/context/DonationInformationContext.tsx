import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

export const DEFAULT_DONATION_INSTRUCTIONS =
  "Food, clothes, books, milk, blankets, baby supplies, hygiene products, household items, and other non-cash donations are welcome. Money, electronics and unsafe items are not accepted.";

interface DonationInformationContextValue {
  instructions: string | null;
  loading: boolean;
  saveInstructions: (instructions: string) => Promise<void>;
}

const DonationInformationContext = createContext<DonationInformationContextValue | null>(null);

export function DonationInformationProvider({ children }: { children: React.ReactNode }) {
  const [instructions, setInstructions] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeGuide: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubscribeGuide?.();
      unsubscribeGuide = undefined;
      if (!fbUser) {
        setInstructions(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeGuide = onSnapshot(
        doc(db, "donationInformation", "publicGuide"),
        (snapshot) => {
          const value = snapshot.exists() ? snapshot.data().instructions : null;
          setInstructions(typeof value === "string" ? value : null);
          setLoading(false);
        },
        (error) => {
          console.warn("[DonationInformationContext] snapshot error:", error.code);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeGuide?.();
      unsubscribeAuth();
    };
  }, []);

  async function saveInstructions(value: string) {
    const fbUser = auth.currentUser;
    const normalized = value.trim();
    if (!fbUser) throw new Error("You must be signed in to save donation information.");
    if (!normalized) throw new Error("Donation instructions cannot be empty.");

    await setDoc(doc(db, "donationInformation", "publicGuide"), {
      instructions: normalized,
      updatedAt: new Date().toISOString(),
      updatedByUid: fbUser.uid,
    });
  }

  return (
    <DonationInformationContext.Provider value={{ instructions, loading, saveInstructions }}>
      {children}
    </DonationInformationContext.Provider>
  );
}

export function useDonationInformation() {
  const context = useContext(DonationInformationContext);
  if (!context) throw new Error("useDonationInformation must be used within DonationInformationProvider");
  return context;
}