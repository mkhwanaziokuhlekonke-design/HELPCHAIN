import {
  addDoc,
  collection,
  deleteDoc,
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

export interface CommunityCentre {
  id: string;
  name: string;
  address: string;
  contact?: string;
  openingHours: string;
  description: string;
  createdAt: string;
}

interface CommunityCentreContextType {
  centres: CommunityCentre[];
  loading: boolean;
  createCentre: (input: Omit<CommunityCentre, "id" | "createdAt">) => Promise<CommunityCentre>;
  updateCentre: (id: string, input: Omit<CommunityCentre, "id" | "createdAt">) => Promise<void>;
  deleteCentre: (id: string) => Promise<void>;
}

const CommunityCentreContext = createContext<CommunityCentreContextType | null>(null);

export function CommunityCentreProvider({ children }: { children: React.ReactNode }) {
  const [centres, setCentres] = useState<CommunityCentre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        setCentres([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const q = query(collection(db, "communityCentres"), orderBy("createdAt", "desc"));
      const unsubSnap = onSnapshot(
        q,
        (snap) => {
          const items: CommunityCentre[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CommunityCentre, "id">),
          }));
          setCentres(items);
          setLoading(false);
        },
        (err) => {
          console.warn("[CommunityCentreContext] snapshot error:", err.code);
          setLoading(false);
        }
      );

      return unsubSnap;
    });

    return () => unsubAuth();
  }, []);

  async function createCentre(input: Omit<CommunityCentre, "id" | "createdAt">): Promise<CommunityCentre> {
    const name = input.name.trim();
    const address = input.address.trim();
    const contact = input.contact?.trim() ?? "";
    const openingHours = input.openingHours.trim();
    const description = input.description.trim();

    if (!name || !address || !openingHours || !description) {
      throw new Error("Please complete the centre name, address, hours, and description.");
    }

    const now = new Date().toISOString();
    const payload = {
      name,
      address,
      ...(contact ? { contact } : {}),
      openingHours,
      description,
      createdAt: now,
      _serverTs: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "communityCentres"), payload);
    return { id: ref.id, ...payload };
  }

  async function updateCentre(id: string, input: Omit<CommunityCentre, "id" | "createdAt">) {
    const name = input.name.trim();
    const address = input.address.trim();
    const contact = input.contact?.trim() ?? "";
    const openingHours = input.openingHours.trim();
    const description = input.description.trim();
    if (!name || !address || !openingHours || !description) {
      throw new Error("Please complete the centre name, address, hours, and description.");
    }
    await updateDoc(doc(db, "communityCentres", id), {
      name,
      address,
      ...(contact ? { contact } : {}),
      openingHours,
      description,
      updatedAt: new Date().toISOString(),
      _serverTs: serverTimestamp(),
    });
  }

  async function deleteCentre(id: string) {
    await deleteDoc(doc(db, "communityCentres", id));
  }

  return (
    <CommunityCentreContext.Provider value={{ centres, loading, createCentre, updateCentre, deleteCentre }}>
      {children}
    </CommunityCentreContext.Provider>
  );
}

export function useCommunityCentres() {
  const ctx = useContext(CommunityCentreContext);
  if (!ctx) throw new Error("useCommunityCentres must be used within CommunityCentreProvider");
  return ctx;
}
