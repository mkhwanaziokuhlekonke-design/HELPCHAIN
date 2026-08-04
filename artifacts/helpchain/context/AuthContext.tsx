import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  createdAt: string;
  requestsCreated: number;
  helpOffered: number;
}

interface AuthContextType {
  user: User | null;
  allUsers: User[];
  loading: boolean;
  locationGranted: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setLocationGranted: (val: boolean) => void;
  updateUserStats: (userId: string, field: "requestsCreated" | "helpOffered") => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_EMAILS = ["admin@helpchain.com"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationGranted, setLocationGrantedState] = useState(false);

  // Listen to auth state changes and load Firestore profile
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        const profile = await loadUserProfile(fbUser.uid);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Listen to all users (for admin panel)
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const users: User[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<User, "id">),
      }));
      setAllUsers(users);
    });
    return () => unsubUsers();
  }, []);

  async function loadUserProfile(uid: string): Promise<User | null> {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        return { id: snap.id, ...(snap.data() as Omit<User, "id">) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await loadUserProfile(cred.user.uid);
      if (profile) {
        setUser(profile);
        return true;
      }
      // Profile missing — create it
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      const newProfile: Omit<User, "id"> = {
        name: email.split("@")[0],
        email: email.toLowerCase(),
        phone: "",
        isAdmin,
        createdAt: new Date().toISOString(),
        requestsCreated: 0,
        helpOffered: 0,
      };
      await setDoc(doc(db, "users", cred.user.uid), newProfile);
      setUser({ id: cred.user.uid, ...newProfile });
      return true;
    } catch {
      return false;
    }
  }

  async function signup(
    name: string,
    email: string,
    phone: string,
    password: string
  ): Promise<boolean> {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      const profile: Omit<User, "id"> = {
        name,
        email: email.toLowerCase(),
        phone,
        isAdmin,
        createdAt: new Date().toISOString(),
        requestsCreated: 0,
        helpOffered: 0,
      };
      await setDoc(doc(db, "users", cred.user.uid), {
        ...profile,
        createdAtServer: serverTimestamp(),
      });
      setUser({ id: cred.user.uid, ...profile });
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  function setLocationGranted(val: boolean) {
    setLocationGrantedState(val);
  }

  async function updateUserStats(
    userId: string,
    field: "requestsCreated" | "helpOffered"
  ) {
    try {
      const ref = doc(db, "users", userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const current = (snap.data() as User)[field] ?? 0;
        await updateDoc(ref, { [field]: current + 1 });
        if (user?.id === userId) {
          setUser((prev) => prev ? { ...prev, [field]: current + 1 } : prev);
        }
      }
    } catch (e) {
      console.error("updateUserStats error", e);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        allUsers,
        loading,
        locationGranted,
        login,
        signup,
        logout,
        setLocationGranted,
        updateUserStats,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
