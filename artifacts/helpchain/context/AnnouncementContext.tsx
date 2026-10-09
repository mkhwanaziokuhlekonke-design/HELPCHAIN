import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { isOfflineFirestoreError } from "@/context/AuthContext";

export type AnnouncementCategory = "general" | "update" | "event" | "emergency";

export interface AppAnnouncement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  category: AnnouncementCategory;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

interface AnnouncementContextType {
  announcements: AppAnnouncement[];
  loading: boolean;
  error: string | null;
  createAnnouncement: (input: {
    title: string;
    body: string;
    imageUrl?: string;
    category?: AnnouncementCategory;
  }) => Promise<AppAnnouncement>;
  updateAnnouncement: (id: string, input: { title: string; body: string; imageUrl?: string | null; category?: AnnouncementCategory }) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
}

const AnnouncementContext = createContext<AnnouncementContextType | null>(null);
export const MAX_ANNOUNCEMENT_IMAGE_LENGTH = 700_000;

function formatFirebaseError(error: unknown): string {
  const details = error as { code?: unknown; message?: unknown };
  const code = typeof details?.code === "string" ? details.code : "unknown";
  const message = typeof details?.message === "string" ? details.message : String(error);
  return `${code}: ${message}`;
}

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setAnnouncements([]);
      setLoading(false);
      setError("Firebase is not configured. Community updates are unavailable.");
      return;
    }

    let unsubSnapshot: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubSnapshot?.();
      unsubSnapshot = undefined;
      if (!fbUser) {
        setAnnouncements([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          const items: AppAnnouncement[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<AppAnnouncement, "id">),
          }));
          setAnnouncements(items);
          setLoading(false);
        },
        (err) => {
          console.warn("[AnnouncementContext] snapshot error:", err.code, err.message);
          setLoading(false);
          setError(`Could not load community updates from Firebase (${formatFirebaseError(err)}).`);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubSnapshot?.();
    };
  }, []);

  async function requireAdmin() {
    const fbUser = auth?.currentUser;
    if (!fbUser || !db) {
      throw new Error("You must be signed in as an administrator.");
    }

    let profileData: Record<string, unknown> = {};
    try {
      const profile = await Promise.race([
        getDoc(doc(db, "users", fbUser.uid)),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("admin-profile-check-timeout")), 5000);
        }),
      ]);
      if (profile.exists()) profileData = profile.data();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (message === "admin-profile-check-timeout") {
        throw new Error("Could not verify admin permissions. Please check your connection and try again.");
      }
      if (!isOfflineFirestoreError(error)) {
        throw new Error(`Could not verify administrator permissions (${formatFirebaseError(error)}).`);
      }
      throw new Error("This action requires admin access and the Firestore profile check is currently unavailable. Please check your connection and try again.");
    }

    if (profileData.isAdmin !== true) {
      throw new Error("Only authorized administrators can manage community updates.");
    }

    return {
      fbUser,
      adminName:
        (typeof profileData.name === "string" && profileData.name.trim()) ||
        fbUser.displayName ||
        "Admin",
    };
  }

  async function createAnnouncement(input: {
    title: string;
    body: string;
    imageUrl?: string;
    category?: AnnouncementCategory;
  }): Promise<AppAnnouncement> {
    const { fbUser, adminName } = await requireAdmin();

    const title = input.title.trim();
    const body = input.body.trim();
    const imageUrl = input.imageUrl?.trim() ?? "";
    const category = input.category ?? "general";

    if (!title || !body) {
      throw new Error("Please add both a title and a message.");
    }
    if (imageUrl.length > MAX_ANNOUNCEMENT_IMAGE_LENGTH) {
      throw new Error("The image is too large. Please choose a smaller image.");
    }

    const now = new Date().toISOString();
    const payload = {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
      category,
      createdById: fbUser.uid,
      createdByName: adminName,
      createdAt: now,
      _serverTs: serverTimestamp(),
    };

    const announcementRef = doc(collection(db, "announcements"));
    try {
      await setDoc(announcementRef, payload);
    } catch (error) {
      const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "unknown";
      if (code === "permission-denied") {
        throw new Error("Firebase rejected the post because the Firestore rules do not allow this admin write.");
      }
      if (isOfflineFirestoreError(error)) {
        throw new Error("The app update could not be saved because the device is offline. Please check your connection and try again.");
      }
      throw new Error(`Could not save the app update (${formatFirebaseError(error)}).`);
    }

    const savedAnnouncement: AppAnnouncement = {
      id: announcementRef.id,
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
      category,
      createdById: fbUser.uid,
      createdByName: adminName,
      createdAt: now,
    };
    setAnnouncements((current) => [
      savedAnnouncement,
      ...current.filter((item) => item.id !== savedAnnouncement.id),
    ]);

    void addDoc(collection(db, "notifications"), {
      title: "New Community Update",
      body: `${title}: ${body}`,
      type: "community_update",
      announcementId: savedAnnouncement.id,
      targetUserId: "all",
      createdByUid: fbUser.uid,
      read: false,
      createdAt: now,
      _serverTs: serverTimestamp(),
    }).catch((notificationError: any) => {
      console.warn("[AnnouncementContext] notification write failed after post was saved:", notificationError?.code);
    });

    return savedAnnouncement;
  }

  async function updateAnnouncement(id: string, input: { title: string; body: string; imageUrl?: string | null; category?: AnnouncementCategory }) {
    await requireAdmin();
    const title = input.title.trim();
    const body = input.body.trim();
    const imageUrl = input.imageUrl?.trim() ?? "";
    const category = input.category ?? "general";
    if (!title || !body) {
      throw new Error("Please add both a title and a message.");
    }
    if (imageUrl.length > MAX_ANNOUNCEMENT_IMAGE_LENGTH) {
      throw new Error("The image is too large. Please choose a smaller image.");
    }

    await updateDoc(doc(db, "announcements", id), {
      title,
      body,
      imageUrl: imageUrl || null,
      category,
      updatedAt: new Date().toISOString(),
      _serverTs: serverTimestamp(),
    });
  }

  async function deleteAnnouncement(id: string) {
    await requireAdmin();
    await deleteDoc(doc(db, "announcements", id));
  }

  return (
    <AnnouncementContext.Provider value={{ announcements, loading, error, createAnnouncement, updateAnnouncement, deleteAnnouncement }}>
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error("useAnnouncements must be used within AnnouncementProvider");
  return ctx;
}
