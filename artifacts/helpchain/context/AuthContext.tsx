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
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<{ ok: boolean; error?: string }>;
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

  // Listen to all users (for admin panel) — fail silently if rules block it
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const users: User[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<User, "id">),
        }));
        setAllUsers(users);
      },
      (err) => {
        console.warn("[Firestore] allUsers listener error (check security rules):", err.code, err.message);
      }
    );
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

  async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await loadUserProfile(cred.user.uid);
      if (profile) {
        setUser(profile);
        return { ok: true };
      }
      // Profile missing — create it from Firebase Auth data
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
      return { ok: true };
    } catch (e: any) {
      const code: string = e?.code ?? "";
      console.error("[Auth] login error:", code, e?.message);
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        return { ok: false, error: "Incorrect email or password." };
      }
      if (code === "auth/invalid-email") {
        return { ok: false, error: "Please enter a valid email address." };
      }
      if (code === "auth/too-many-requests") {
        return { ok: false, error: "Too many attempts. Please try again later." };
      }
      if (code === "auth/operation-not-allowed") {
        return { ok: false, error: "Email/Password sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in methods." };
      }
      if (code === "auth/network-request-failed") {
        return { ok: false, error: "Network error. Please check your internet connection and try again." };
      }
      if (code === "auth/app-not-authorized" || code === "auth/invalid-api-key" || code.includes("api-key-not-valid")) {
        return { ok: false, error: "Invalid Firebase API key. Please re-enter the correct EXPO_PUBLIC_FIREBASE_API_KEY in Replit Secrets." };
      }
      return { ok: false, error: `Login failed (${code || "unknown"}). Please check your connection and try again.` };
    }
  }

  async function signup(
    name: string,
    email: string,
    phone: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> {
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
      return { ok: true };
    } catch (e: any) {
      const code: string = e?.code ?? "";
      console.error("[Auth] signup error:", code, e?.message);
      if (code === "auth/email-already-in-use") {
        return { ok: false, error: "An account with this email already exists. Please sign in instead." };
      }
      if (code === "auth/invalid-email") {
        return { ok: false, error: "Please enter a valid email address." };
      }
      if (code === "auth/weak-password") {
        return { ok: false, error: "Password is too weak. Please use at least 8 characters with a mix of letters, numbers, and symbols." };
      }
      if (code === "auth/operation-not-allowed") {
        return { ok: false, error: "Email/Password sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in methods and enable Email/Password." };
      }
      if (code === "auth/network-request-failed") {
        return { ok: false, error: "Network error. Please check your internet connection and try again." };
      }
      if (code === "auth/app-not-authorized" || code === "auth/invalid-api-key" || code.includes("api-key-not-valid")) {
        return { ok: false, error: "Invalid Firebase API key. Update EXPO_PUBLIC_FIREBASE_API_KEY in Replit Secrets with the correct value from Firebase Console → Project Settings." };
      }
      return { ok: false, error: `Sign up failed (${code || "unknown"}).` };
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
