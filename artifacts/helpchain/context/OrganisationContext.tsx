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

export interface VerifiedOrganisation {
  id: string;
  name: string;
  type: string;
  location: string;
  contact: string;
  description: string;
  createdAt: string;
}

interface OrganisationContextType {
  organisations: VerifiedOrganisation[];
  loading: boolean;
  createOrganisation: (input: Omit<VerifiedOrganisation, "id" | "createdAt">) => Promise<VerifiedOrganisation>;
  updateOrganisation: (id: string, input: Omit<VerifiedOrganisation, "id" | "createdAt">) => Promise<void>;
  deleteOrganisation: (id: string) => Promise<void>;
}

const OrganisationContext = createContext<OrganisationContextType | null>(null);

export function OrganisationProvider({ children }: { children: React.ReactNode }) {
  const [organisations, setOrganisations] = useState<VerifiedOrganisation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        setOrganisations([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const q = query(collection(db, "organisations"), orderBy("createdAt", "desc"));
      const unsubSnap = onSnapshot(
        q,
        (snap) => {
          const items: VerifiedOrganisation[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<VerifiedOrganisation, "id">),
          }));
          setOrganisations(items);
          setLoading(false);
        },
        (err) => {
          console.warn("[OrganisationContext] snapshot error:", err.code);
          setLoading(false);
        }
      );

      return unsubSnap;
    });

    return () => unsubAuth();
  }, []);

  async function createOrganisation(input: Omit<VerifiedOrganisation, "id" | "createdAt">): Promise<VerifiedOrganisation> {
    const name = input.name.trim();
    const type = input.type.trim();
    const location = input.location.trim();
    const contact = input.contact.trim();
    const description = input.description.trim();

    if (!name || !type || !location || !contact || !description) {
      throw new Error("Please complete all organisation fields.");
    }

    const now = new Date().toISOString();
    const payload = { ...input, name, type, location, contact, description, createdAt: now, _serverTs: serverTimestamp() };
    const ref = await addDoc(collection(db, "organisations"), payload);
    return { id: ref.id, ...payload };
  }

  async function updateOrganisation(id: string, input: Omit<VerifiedOrganisation, "id" | "createdAt">) {
    const name = input.name.trim();
    const type = input.type.trim();
    const location = input.location.trim();
    const contact = input.contact.trim();
    const description = input.description.trim();
    if (!name || !type || !location || !contact || !description) {
      throw new Error("Please complete all organisation fields.");
    }
    await updateDoc(doc(db, "organisations", id), {
      ...input,
      name,
      type,
      location,
      contact,
      description,
      updatedAt: new Date().toISOString(),
      _serverTs: serverTimestamp(),
    });
  }

  async function deleteOrganisation(id: string) {
    await deleteDoc(doc(db, "organisations", id));
  }

  return (
    <OrganisationContext.Provider value={{ organisations, loading, createOrganisation, updateOrganisation, deleteOrganisation }}>
      {children}
    </OrganisationContext.Provider>
  );
}

export function useOrganisations() {
  const ctx = useContext(OrganisationContext);
  if (!ctx) throw new Error("useOrganisations must be used within OrganisationProvider");
  return ctx;
}
