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
import { useAuth } from "@/context/AuthContext";

export interface EmergencyAlertLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  serviceKey: string;
  serviceName: string;
  serviceNumber: string;
  location?: EmergencyAlertLocation;
  createdAt: string;
}

interface CreateEmergencyAlertInput {
  serviceKey: string;
  serviceName: string;
  serviceNumber: string;
  location?: EmergencyAlertLocation;
}

interface EmergencyAlertContextType {
  emergencyAlerts: EmergencyAlert[];
  createEmergencyAlert: (input: CreateEmergencyAlertInput) => Promise<void>;
}

const EmergencyAlertContext = createContext<EmergencyAlertContextType | null>(null);

export function EmergencyAlertProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);

  // Only admins read the shared emergency alert stream. Regular users create
  // their own alert but do not receive every other user's emergency data.
  useEffect(() => {
    if (!user?.isAdmin) {
      setEmergencyAlerts([]);
      return;
    }

    const alertsQuery = query(
      collection(db, "emergencyAlerts"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        setEmergencyAlerts(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<EmergencyAlert, "id">),
          }))
        );
      },
      (error) => console.warn("[EmergencyAlertContext] snapshot error:", error.code)
    );

    return unsubscribe;
  }, [user?.id, user?.isAdmin]);

  async function createEmergencyAlert(input: CreateEmergencyAlertInput) {
    if (!user) throw new Error("You must be signed in to send an emergency alert.");

    await addDoc(collection(db, "emergencyAlerts"), {
      userId: user.id,
      userName: user.name,
      userPhone: user.phone ?? "",
      serviceKey: input.serviceKey,
      serviceName: input.serviceName,
      serviceNumber: input.serviceNumber,
      ...(input.location ? { location: input.location } : {}),
      createdAt: new Date().toISOString(),
      _serverTs: serverTimestamp(),
    });
  }

  return (
    <EmergencyAlertContext.Provider value={{ emergencyAlerts, createEmergencyAlert }}>
      {children}
    </EmergencyAlertContext.Provider>
  );
}

export function useEmergencyAlerts() {
  const context = useContext(EmergencyAlertContext);
  if (!context) {
    throw new Error("useEmergencyAlerts must be used within EmergencyAlertProvider");
  }
  return context;
}