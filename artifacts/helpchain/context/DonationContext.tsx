import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

export interface DonationLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface DonationDestination {
  id: string;
  name: string;
  type: "church" | "center";
  latitude?: number;
  longitude?: number;
  address?: string;
  contact?: string;
  openingHours?: string;
  description?: string;
}

export interface Donation {
  id: string;
  donationId?: string;
  donorId: string;
  donorName: string;
  donorEmail?: string;
  itemType: string;
  itemIcon: string;
  quantity: number;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  status: "pending-delivery" | "delivered" | "received-verified" | "distributed" | "completed" | "investigation" | "registered" | "received";
  statusHistory?: Array<{ status: string; at: string }>;
  receivedAt?: string;
  receivedById?: string;
  receivedByName?: string;
  receivedCentreId?: string;
  receivedCentreName?: string;
  quantityReceived?: number;
  inventoryListedQuantity?: number;
  distributedQuantity?: number;
  directDistributedQuantity?: number;
  quantityCollected?: number;
  investigation?: {
    reason: string;
    previousStatus: Donation["status"];
    openedAt: string;
    openedById: string;
    openedByName: string;
  };
  proofPhoto?: string;
  campaignId?: string;
  campaignCreatorId?: string;
  /** GPS position of the donor at the time of donation (optional — only set when permission granted) */
  location?: DonationLocation;
  /** Chosen donation destination, selected from nearby churches/community centres. */
  destination?: DonationDestination;
}

export interface AvailableDonationItem {
  id: string;
  donationRefId: string;
  sourceDonationId: string;
  itemName: string;
  description: string;
  category: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityCollected: number;
  photo?: string;
  centreId: string;
  communityCentre: string;
  collectionHours: number;
  collectionDeadline: string;
  addedById: string;
  createdAt: string;
  active: boolean;
}

export interface DonationItemRequest {
  id: string;
  requestId: string;
  userId: string;
  userName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  centreId: string;
  communityCentre: string;
  status: "pending" | "approved" | "rejected" | "expired" | "collected";
  createdAt: string;
  reservationExpiresAt?: string | null;
  collectionCode?: string;
  collectionId?: string;
  confirmedByName?: string;
  collectedAt?: string;
}

interface DonationContextType {
  donations: Donation[];
  availableItems: AvailableDonationItem[];
  itemRequests: DonationItemRequest[];
  loading: boolean;
  error: string | null;
  addDonation: (
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string,
    location?: DonationLocation,
    destination?: DonationDestination,
    campaignId?: string,
    campaignCreatorId?: string
  ) => Promise<Donation>;
  updateDonationStatus: (id: string, status: Donation["status"]) => Promise<void>;
  createAvailableItem: (input: {
    donationId: string;
    itemName: string;
    description: string;
    category: string;
    quantity: number;
    photo?: string;
    collectionHours: number;
  }) => Promise<void>;
  requestAvailableItem: (itemId: string, quantity: number) => Promise<void>;
  decideItemRequest: (requestId: string, decision: "approved" | "rejected", collectionHours?: number) => Promise<void>;
  confirmItemCollection: (requestId: string, code: string) => Promise<void>;
  getCollectionCode: (requestId: string) => Promise<string>;
  confirmDonationReceipt: (donationId: string, quantityReceived: number, proofPhoto?: string) => Promise<void>;
  recordDonationDistribution: (
    donationId: string,
    item: string,
    quantity: number,
    beneficiaryCategory: string,
    proofPhoto: string
  ) => Promise<void>;
  investigateDonation: (donationId: string, reason: string) => Promise<void>;
  resolveDonationInvestigation: (donationId: string, resolution: string) => Promise<void>;
  authorizeCentreReceiver: (userId: string, centreId: string, enabled: boolean) => Promise<void>;
  totalItems: number;
}

const DonationContext = createContext<DonationContextType | null>(null);

function formatFirebaseError(error: unknown): string {
  const details = error as { code?: unknown; message?: unknown };
  const code = typeof details?.code === "string" ? details.code : "unknown";
  const message = typeof details?.message === "string" ? details.message : String(error);
  return `${code}: ${message}`;
}

export function DonationProvider({ children }: { children: React.ReactNode }) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableDonationItem[]>([]);
  const [itemRequests, setItemRequests] = useState<DonationItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setDonations([]);
      setLoading(false);
      setError("Firebase is not configured. Donation records are unavailable.");
      return;
    }

    let unsubSnap: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubSnap?.();
      unsubSnap = undefined;
      if (!fbUser) {
        setDonations([]);
        setAvailableItems([]);
        setItemRequests([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const profile = await getDoc(doc(db, "users", fbUser.uid));
        const profileData = profile.exists() ? (profile.data() as Record<string, unknown>) : undefined;
        const isAdmin = profileData?.isAdmin === true;
        const donationsQuery = isAdmin
          ? query(collection(db, "donations"))
          : query(collection(db, "donations"), where("donorId", "==", fbUser.uid));
        unsubSnap = onSnapshot(
          donationsQuery,
          (snap) => {
            const items: Donation[] = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Donation, "id">) }))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setDonations(items);
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.warn("[DonationContext] snapshot error:", err.code, err.message);
            setLoading(false);
            setError(`Could not load donations from Firebase (${formatFirebaseError(err)}).`);
          }
        );
        const inventoryQuery = query(collection(db, "donationInventory"));
        const unsubInventory = onSnapshot(
          inventoryQuery,
          (snap) => setAvailableItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AvailableDonationItem, "id">) }))),
          (err) => console.warn("[DonationContext] inventory listener error:", err.code, err.message)
        );
        const requestQueries = isAdmin
          ? [query(collection(db, "donationRequests"))]
          : [
              query(collection(db, "donationRequests"), where("userId", "==", fbUser.uid)),
              ...(profileData?.isCentreReceiver === true && Array.isArray(profileData.authorizedCentreIds)
                ? profileData.authorizedCentreIds
                    .filter((id): id is string => typeof id === "string")
                    .map((centreId) => query(collection(db, "donationRequests"), where("centreId", "==", centreId)))
                : []),
            ];
        const requestsById = new Map<string, DonationItemRequest>();
        const requestListeners = requestQueries.map((requestQuery) =>
          onSnapshot(
            requestQuery,
            (snap) => {
              snap.docs.forEach((d) => requestsById.set(d.id, { id: d.id, ...(d.data() as Omit<DonationItemRequest, "id">) }));
              setItemRequests([...requestsById.values()]);
            },
            (err) => console.warn("[DonationContext] request listener error:", err.code, err.message)
          )
        );
        const unsubscribers = [unsubInventory, ...requestListeners];
        const priorUnsub = unsubSnap;
        unsubSnap = () => {
          priorUnsub?.();
          unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
        if (isAdmin) {
          void callDonationApi("/api/donation-requests/expire", { method: "GET" }).catch((error) => {
            console.warn("[DonationContext] could not process expired collection reservations:", error);
          });
        }
      } catch (err: any) {
        console.warn("[DonationContext] profile lookup failed:", err?.code, err?.message);
        setDonations([]);
        setLoading(false);
        setError(`Could not verify donation permissions (${formatFirebaseError(err)}).`);
      }
    });
    return () => {
      unsubSnap?.();
      unsubAuth();
    };
  }, []);

  async function callDonationApi<T = Record<string, unknown>>(
    path: string,
    options: { method?: "GET" | "POST" | "PUT"; body?: Record<string, unknown> } = {}
  ): Promise<T> {
    if (!auth?.currentUser) throw new Error("Sign in to continue.");
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error(
        "The secure donation service URL is missing. Set EXPO_PUBLIC_API_BASE_URL in artifacts/helpchain/.env to the deployed API server's base URL, then restart Expo."
      );
    }
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const result = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The donation service could not complete this request.");
    return result;
  }

  async function addDonation(
    donorId: string,
    donorName: string,
    itemType: string,
    itemIcon: string,
    quantity: number,
    description?: string,
    location?: DonationLocation,
    destination?: DonationDestination,
    campaignId?: string,
    campaignCreatorId?: string
  ) {
    setError(null);
    try {
      if (!auth?.currentUser || !db) {
        throw new Error("You must be signed in and Firebase must be configured to register a donation.");
      }
      if (auth.currentUser.uid !== donorId) {
        throw new Error("The signed-in account can only register a donation for itself.");
      }
      if ((campaignId && !campaignCreatorId) || (!campaignId && campaignCreatorId)) {
        throw new Error("Campaign metadata is incomplete. Please provide both campaignId and campaignCreatorId together.");
      }

      const createdAt = new Date().toISOString();
      const communityCentre = destination?.name ?? "a community centre";
      const response = await callDonationApi<{
        id: string;
        donationId: string;
        status: Donation["status"];
        createdAt: string;
      }>("/api/donations", {
        body: {
          itemType,
          itemIcon,
          quantity,
          description: description ?? "",
          destination,
          ...(campaignId ? { campaignId, campaignCreatorId } : {}),
        },
      });

      const savedDonation: Donation = {
        id: response.id,
        donationId: response.donationId,
        donorId,
        donorName,
        itemType,
        itemIcon,
        quantity,
        description: description ?? "",
        ...(location ? { location } : {}),
        ...(destination ? { destination } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(campaignCreatorId ? { campaignCreatorId } : {}),
        status: response.status,
        statusHistory: [{ status: response.status, at: response.createdAt }],
        createdAt: response.createdAt,
      };
      setDonations((current) => [savedDonation, ...current.filter((item) => item.id !== savedDonation.id)]);

      if (campaignId && campaignCreatorId) {
        try {
          const campaignRef = doc(db, "campaigns", campaignId);
          const campaignSnap = await getDoc(campaignRef);
          if (!campaignSnap.exists()) {
            throw new Error(`Campaign ${campaignId} does not exist.`);
          }
          const currentRaised = Number(campaignSnap.data()?.raisedAmount ?? 0);
          const currentDonorCount = Number(campaignSnap.data()?.donorCount ?? 0);
          await updateDoc(campaignRef, {
            raisedAmount: currentRaised + quantity,
            donorCount: currentDonorCount + 1,
            updatedAt: new Date().toISOString(),
          });
        } catch (campaignError: any) {
          console.error("[DonationContext] campaign update failed:", {
            operation: "updateDoc(campaigns)",
            code: campaignError?.code,
            message: campaignError?.message,
            campaignId,
            campaignCreatorId,
            donorId,
          });
          setError("Donation saved, but the campaign totals could not be updated. The donation is still visible in My Donations.");
        }
      }

      return savedDonation;
    } catch (e: any) {
      console.error("[DonationContext] addDonation failed:", {
        code: e?.code,
        message: e?.message,
        operation: "addDonation()",
        donorId,
        itemType,
        quantity,
      });
      setError(`Could not register donation (${formatFirebaseError(e)}).`);
      throw e;
    }
  }

  async function updateDonationStatus(id: string, status: Donation["status"]) {
    setError(null);
    try {
      if (!auth?.currentUser) throw new Error("Sign in to update donation status.");
      if (status !== "delivered") throw new Error("Only donors can mark items as delivered.");
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
      if (!baseUrl) {
        throw new Error(
          "The secure donation service URL is missing. Set EXPO_PUBLIC_API_BASE_URL in artifacts/helpchain/.env to the deployed API server's base URL, then restart Expo."
        );
      }
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${baseUrl}/api/donations/${encodeURIComponent(id)}/delivered`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not update donation status.");
    } catch (updateError) {
      setError(`Could not update donation (${formatFirebaseError(updateError)}).`);
      throw updateError;
    }
  }

  async function createAvailableItem(input: {
    donationId: string;
    description: string;
    category: string;
    quantity: number;
    photo?: string;
    collectionHours: number;
  }) {
    await callDonationApi("/api/donation-inventory", { body: input });
  }

  async function requestAvailableItem(itemId: string, quantity: number) {
    await callDonationApi("/api/donation-requests", { body: { itemId, quantity } });
  }

  async function decideItemRequest(requestId: string, decision: "approved" | "rejected", collectionHours?: number) {
    await callDonationApi(`/api/donation-requests/${encodeURIComponent(requestId)}/decision`, {
      body: { decision, ...(collectionHours === undefined ? {} : { collectionHours }) },
    });
  }

  async function confirmItemCollection(requestId: string, code: string) {
    await callDonationApi(`/api/donation-requests/${encodeURIComponent(requestId)}/collect`, {
      body: { code },
    });
  }

  async function getCollectionCode(requestId: string) {
    const result = await callDonationApi<{ collectionCode: string }>(
      `/api/donation-requests/${encodeURIComponent(requestId)}/code`,
      { method: "GET" }
    );
    return result.collectionCode;
  }

  async function confirmDonationReceipt(
    donationId: string,
    quantityReceived: number,
    proofPhoto?: string
  ) {
    await callDonationApi(`/api/donations/${encodeURIComponent(donationId)}/receive`, {
      body: { quantityReceived, ...(proofPhoto ? { proofPhoto } : {}) },
    });
  }

  async function recordDonationDistribution(
    donationId: string,
    item: string,
    quantity: number,
    beneficiaryCategory: string,
    proofPhoto: string
  ) {
    await callDonationApi(`/api/donations/${encodeURIComponent(donationId)}/distribute`, {
      body: { item, quantity, beneficiaryCategory, proofPhoto },
    });
  }

  async function investigateDonation(donationId: string, reason: string) {
    await callDonationApi(`/api/donations/${encodeURIComponent(donationId)}/investigate`, {
      body: { reason },
    });
  }

  async function resolveDonationInvestigation(donationId: string, resolution: string) {
    await callDonationApi(`/api/donations/${encodeURIComponent(donationId)}/investigation/resolve`, {
      body: { resolution },
    });
  }

  async function authorizeCentreReceiver(userId: string, centreId: string, enabled: boolean) {
    await callDonationApi(
      `/api/receivers/${encodeURIComponent(userId)}/centres/${encodeURIComponent(centreId)}`,
      { method: "PUT", body: { enabled } }
    );
  }

  const totalItems = donations.reduce((sum, d) => sum + d.quantity, 0);

  return (
    <DonationContext.Provider value={{
      donations,
      availableItems,
      itemRequests,
      loading,
      error,
      addDonation,
      updateDonationStatus,
      createAvailableItem,
      requestAvailableItem,
      decideItemRequest,
      confirmItemCollection,
      getCollectionCode,
      confirmDonationReceipt,
      recordDonationDistribution,
      investigateDonation,
      resolveDonationInvestigation,
      authorizeCentreReceiver,
      totalItems,
    }}>
      {children}
    </DonationContext.Provider>
  );
}

export function useDonations() {
  const ctx = useContext(DonationContext);
  if (!ctx) throw new Error("useDonations must be used within DonationProvider");
  return ctx;
}
