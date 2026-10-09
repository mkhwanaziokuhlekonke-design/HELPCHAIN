import {
  EmailAuthProvider,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
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
  isCentreReceiver?: boolean;
  authorizedCentreIds?: string[];
  emailVerified?: boolean;
  suspended?: boolean;
  createdAt: string;
  updatedAt?: string;
  requestsCreated: number;
  helpOffered: number;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null;
  allUsers: User[];
  allUsersLoading: boolean;
  allUsersError: string | null;
  loading: boolean;
  locationGranted: boolean;
  emailVerificationExpiresAt: number | null;
  emailVerificationResendAt: number | null;
  login: (email: string, password: string) => Promise<{
    ok: boolean;
    error?: string;
    user?: User;
    profileFound?: boolean;
    profilePath?: string;
    projectId?: string;
    adminRoleStatus?: "enabled" | "missing" | "not-boolean-true";
  }>;
  signup: (name: string, email: string, password: string) => Promise<{
    ok: boolean;
    error?: string;
    verificationPending?: boolean;
    expiresAt?: number;
    resendAt?: number;
  }>;
  resendEmailVerificationOtp: () => Promise<{
    ok: boolean;
    error?: string;
    expiresAt?: number;
    resendAt?: number;
    retryAfterSeconds?: number;
  }>;
  verifyEmailOtp: (code: string) => Promise<{ ok: boolean; error?: string; user?: User }>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  setLocationGranted: (val: boolean) => void;
  updateUserStats: (userId: string, field: "requestsCreated" | "helpOffered") => void;
  updateProfilePhoto: (photoURL: string) => Promise<void>;
  updateProfileName: (name: string, phone: string, email: string, password?: string) => Promise<void>;
  toggleAdminRole: (userId: string) => Promise<void>;
  suspendUser: (userId: string, suspend: boolean) => Promise<void>;
  deleteUserFromFirestore: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface OtpApiResult {
  ok: boolean;
  error?: string;
  expiresAt?: number;
  resendAt?: number;
  retryAfterSeconds?: number;
}

async function requestEmailOtp(
  action: "send" | "verify",
  code?: string
): Promise<OtpApiResult> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return {
      ok: false,
      error: "Email verification is not configured. Please contact HelpChain support.",
    };
  }
  const firebaseUser = auth?.currentUser;
  if (!firebaseUser) {
    return { ok: false, error: "Your sign-in session expired. Please sign in again." };
  }

  try {
    const token = await firebaseUser.getIdToken();
    const response = await fetch(`${baseUrl}/api/auth/email-otp/${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: action === "verify" ? JSON.stringify({ code }) : "{}",
    });
    const result = await response.json() as Omit<OtpApiResult, "ok">;
    if (!response.ok) {
      return {
        ...result,
        ok: false,
        error: result.error ?? "Email verification could not be completed. Please try again.",
      };
    }
    return { ...result, ok: true };
  } catch (error) {
    console.error("[Auth] email OTP request failed:", error);
    return {
      ok: false,
      error: "We could not reach the email verification service. Check your connection and try again.",
    };
  }
}

export function isOfflineFirestoreError(error: unknown): boolean {
  const code = typeof (error as { code?: unknown })?.code === "string"
    ? (error as { code: string }).code
    : "";
  const message = typeof (error as { message?: unknown })?.message === "string"
    ? (error as { message: string }).message
    : "";

  return code === "unavailable" || /offline|network/i.test(message);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(true);
  const [allUsersError, setAllUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationGranted, setLocationGrantedState] = useState(false);
  const [emailVerificationExpiresAt, setEmailVerificationExpiresAt] = useState<number | null>(null);
  const [emailVerificationResendAt, setEmailVerificationResendAt] = useState<number | null>(null);

  // Listen to auth state changes and load Firestore profile
  useEffect(() => {
    if (!auth || !db) {
      setUser(null);
      setAllUsers([]);
      setLoading(false);
      return;
    }

    let active = true;
    let authStateRequest = 0;
    const unsubAuth = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      const request = ++authStateRequest;
      if (fbUser) {
        let profile: User | null;
        try {
          profile = await loadUserProfile(fbUser.uid);
        } catch (error) {
          console.error("[Auth] could not load Firestore profile:", {
            uid: fbUser.uid,
            projectId: auth.app.options.projectId,
            error,
          });
          if (!active || request !== authStateRequest) return;
          setUser({
            id: fbUser.uid,
            name: fbUser.displayName ?? fbUser.email?.split("@")[0] ?? "User",
            email: fbUser.email ?? "",
            phone: "",
            isAdmin: false,
            emailVerified: fbUser.emailVerified,
            createdAt: fbUser.metadata.creationTime ?? new Date().toISOString(),
            requestsCreated: 0,
            helpOffered: 0,
          });
          setLoading(false);
          return;
        }
        if (!active || request !== authStateRequest) return;
        if (profile) {
          setUser({
            ...profile,
            isAdmin: profile.isAdmin === true,
            emailVerified: profile.emailVerified !== false,
          });
        } else {
          // Firestore profile missing or rules not yet published — build a
          // minimal user from Firebase Auth data so the app is never stuck
          // in a "user is null while authenticated" state.
          setUser({
            id: fbUser.uid,
            name:
              fbUser.displayName ??
              fbUser.email?.split("@")[0] ??
              "User",
            email: fbUser.email ?? "",
            phone: "",
            isAdmin: false,
            emailVerified: fbUser.emailVerified,
            createdAt:
              fbUser.metadata.creationTime ?? new Date().toISOString(),
            requestsCreated: 0,
            helpOffered: 0,
          });
        }
      } else {
        if (!active || request !== authStateRequest) return;
        setUser(null);
      }
      setLoading(false);
    });
    return () => {
      active = false;
      authStateRequest += 1;
      unsubAuth();
    };
  }, []);

  // Keep the user directory private; only load it for administrators.
  useEffect(() => {
    if (!auth || !db) {
      setAllUsers([]);
      setAllUsersLoading(false);
      setAllUsersError("Firebase is not configured.");
      return;
    }

    let unsubUsers: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubUsers?.();
      unsubUsers = undefined;
      if (!fbUser) {
        setAllUsers([]);
        setAllUsersLoading(false);
        setAllUsersError(null);
        return;
      }
      if (!user?.isAdmin) {
        setAllUsers([]);
        setAllUsersLoading(false);
        setAllUsersError(null);
        return;
      }
      setAllUsersLoading(true);
      setAllUsersError(null);
      unsubUsers = onSnapshot(
        collection(db, "users"),
        (snap) => {
          const users: User[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<User, "id">),
          }));
          setAllUsers(users);
          setAllUsersLoading(false);
          setAllUsersError(null);
        },
        (err) => {
          console.warn("[Firestore] allUsers listener error:", err.code);
          setAllUsersLoading(false);
          setAllUsersError("Could not load registered users from Firebase.");
        }
      );
    });
    return () => {
      unsubAuth();
      unsubUsers?.();
    };
  }, [user?.isAdmin]);

  async function loadUserProfile(uid: string): Promise<User | null> {
    if (!db) throw new Error("Firestore is not configured.");
    if (!auth || db.app !== auth.app) {
      throw new Error("Firebase Authentication and Firestore are not using the same Firebase app.");
    }
    if (db.app.options.projectId !== auth.app.options.projectId) {
      throw new Error("Firebase Authentication and Firestore are configured for different projects.");
    }

    const profileRef = doc(db, "users", uid);
    const snap = await getDocFromServer(profileRef);
    if (!snap.exists()) return null;
    if (snap.ref.path !== `users/${uid}`) {
      throw new Error(`Firestore returned an unexpected profile path: ${snap.ref.path}.`);
    }

    const data = snap.data();
    if (typeof data.isAdmin !== "boolean" && data.isAdmin !== undefined) {
      console.warn("[Auth] admin role is not stored as a Boolean:", {
        uid,
        projectId: db.app.options.projectId,
        profilePath: snap.ref.path,
        fieldType: typeof data.isAdmin,
      });
    }
    return {
      id: snap.id,
      ...(data as Omit<User, "id">),
      isAdmin: data.isAdmin === true,
    };
  }

  async function login(
    email: string,
    password: string
  ): Promise<{
    ok: boolean;
    error?: string;
    user?: User;
    profileFound?: boolean;
    profilePath?: string;
    projectId?: string;
    adminRoleStatus?: "enabled" | "missing" | "not-boolean-true";
  }> {
    if (!auth || !db) {
      return { ok: false, error: "Firebase is not configured. Add your EXPO_PUBLIC_FIREBASE_* values to the app .env file." };
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      let profile: User | null;
      try {
        profile = await loadUserProfile(cred.user.uid);
      } catch (profileError) {
        console.error("[Auth] could not verify account permissions:", {
          uid: cred.user.uid,
          projectId: auth.app.options.projectId,
          profilePath: `users/${cred.user.uid}`,
          error: profileError,
        });
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("[Auth] could not sign out after profile read failure:", signOutError);
        }
        return {
          ok: false,
          error: "We could not load your user profile from Firestore. Check your connection and account permissions, then try again.",
        };
      }
      const authenticatedUser: User = profile
        ? {
            ...profile,
            isAdmin: profile.isAdmin === true,
            emailVerified: profile.emailVerified !== false,
          }
        : {
            id: cred.user.uid,
            name: cred.user.displayName ?? cred.user.email?.split("@")[0] ?? "User",
            email: cred.user.email ?? "",
            phone: "",
            isAdmin: false,
            emailVerified: cred.user.emailVerified,
            createdAt: cred.user.metadata.creationTime ?? new Date().toISOString(),
            requestsCreated: 0,
            helpOffered: 0,
          };
      setUser(authenticatedUser);

      const profileFound = profile !== null;
      const adminRoleStatus = !profile
        ? "missing"
        : profile.isAdmin
          ? "enabled"
          : "not-boolean-true";
      return {
        ok: true,
        user: authenticatedUser,
        profileFound,
        profilePath: `users/${cred.user.uid}`,
        projectId: db.app.options.projectId,
        adminRoleStatus,
      };
    } catch (e: any) {
      const code: string = e?.code ?? "";
      console.error("[Auth] login error:", code, e?.message);
      const firebaseDetails = __DEV__ && (code || e?.message)
        ? ` (Firebase: ${code}${e?.message ? `: ${e.message}` : ""})`
        : "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        return { ok: false, error: `Incorrect email or password.${firebaseDetails}` };
      }
      if (code === "auth/invalid-email") {
        return { ok: false, error: `Please enter a valid email address.${firebaseDetails}` };
      }
      if (code === "auth/too-many-requests") {
        return { ok: false, error: `Too many attempts. Please try again later.${firebaseDetails}` };
      }
      if (code === "auth/operation-not-allowed") {
        return { ok: false, error: `Email/Password sign-in is not enabled. Check Firebase Authentication sign-in methods.${firebaseDetails}` };
      }
      if (code === "auth/configuration-not-found") {
        return {
          ok: false,
          error: `Firebase Authentication is not configured for this project. Open Firebase Console → Authentication → Sign-in method, enable Email/Password, and confirm the app is using the correct project config.${firebaseDetails}`,
        };
      }
      if (code === "auth/network-request-failed") {
        return { ok: false, error: `Network error. Please check your internet connection and try again.${firebaseDetails}` };
      }
      if (code === "auth/app-not-authorized" || code === "auth/invalid-api-key" || code.includes("api-key-not-valid")) {
        return { ok: false, error: `Invalid Firebase API key. Verify the existing app configuration.${firebaseDetails}` };
      }
      return { ok: false, error: `Login failed. Please check your connection and try again.${firebaseDetails || ` (Firebase: ${code || "unknown"})`}` };
    }
  }

  async function signup(
    name: string,
    email: string,
    password: string
  ): Promise<{
    ok: boolean;
    error?: string;
    verificationPending?: boolean;
    expiresAt?: number;
    resendAt?: number;
  }> {
    if (!auth || !db) {
      return { ok: false, error: "Firebase is not configured. Add your EXPO_PUBLIC_FIREBASE_* values to the app .env file." };
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const profile: Omit<User, "id"> = {
        name,
        email: email.toLowerCase(),
        phone: "",
        isAdmin: false,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        requestsCreated: 0,
        helpOffered: 0,
      };
      await setDoc(doc(db, "users", cred.user.uid), {
        ...profile,
        createdAtServer: serverTimestamp(),
      });
      setUser({ id: cred.user.uid, ...profile });
      const otp = await requestEmailOtp("send");
      setEmailVerificationExpiresAt(otp.expiresAt ?? null);
      setEmailVerificationResendAt(otp.resendAt ?? null);
      if (!otp.ok) {
        return {
          ok: false,
          verificationPending: true,
          error: otp.error,
        };
      }
      return { ok: true, expiresAt: otp.expiresAt, resendAt: otp.resendAt };
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
      if (code === "auth/configuration-not-found") {
        return {
          ok: false,
          error: "Firebase Authentication is not configured for this project. In Firebase Console → Authentication → Sign-in method, enable Email/Password and verify the app is using the correct Firebase project.",
        };
      }
      if (code === "auth/network-request-failed") {
        return { ok: false, error: "Network error. Please check your internet connection and try again." };
      }
      if (code === "auth/app-not-authorized" || code === "auth/invalid-api-key" || code.includes("api-key-not-valid")) {
        return { ok: false, error: "Invalid Firebase API key. Check EXPO_PUBLIC_FIREBASE_API_KEY in artifacts/helpchain/.env against Firebase Console → Project settings → Your apps." };
      }
      return { ok: false, error: `Sign up failed (${code || "unknown"}).` };
    }
  }

  async function resendEmailVerificationOtp() {
    const result = await requestEmailOtp("send");
    if (result.expiresAt) setEmailVerificationExpiresAt(result.expiresAt);
    if (result.resendAt) setEmailVerificationResendAt(result.resendAt);
    return result;
  }

  async function verifyEmailOtp(code: string): Promise<{ ok: boolean; error?: string; user?: User }> {
    const result = await requestEmailOtp("verify", code);
    if (!result.ok) return result;

    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser || !db) {
        return { ok: false, error: "Your sign-in session expired. Please sign in again." };
      }
      await reload(firebaseUser);
      await firebaseUser.getIdToken(true);
      const profile = await getDoc(doc(db, "users", firebaseUser.uid));
      const profileData = profile.exists()
        ? profile.data() as Omit<User, "id">
        : null;
      const verifiedUser: User = {
        id: firebaseUser.uid,
        name: profileData?.name ?? firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "User",
        email: profileData?.email ?? firebaseUser.email ?? "",
        phone: profileData?.phone ?? "",
        isAdmin: profileData?.isAdmin === true,
        emailVerified: profileData?.emailVerified === true,
        createdAt: profileData?.createdAt ?? firebaseUser.metadata.creationTime ?? new Date().toISOString(),
        requestsCreated: profileData?.requestsCreated ?? 0,
        helpOffered: profileData?.helpOffered ?? 0,
        suspended: profileData?.suspended,
        updatedAt: profileData?.updatedAt,
        photoURL: profileData?.photoURL,
      };
      if (!verifiedUser.emailVerified) {
        return { ok: false, error: "Your email verification is still processing. Please try again." };
      }
      setUser(verifiedUser);
      setEmailVerificationExpiresAt(null);
      setEmailVerificationResendAt(null);
      return { ok: true, user: verifiedUser };
    } catch (error) {
      console.error("[Auth] verified account refresh failed:", error);
      return { ok: false, error: "Your code was accepted, but we could not refresh your account. Please try again." };
    }
  }

  async function resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
    if (!auth) {
      return { ok: false, error: "Firebase is not configured. Add your EXPO_PUBLIC_FIREBASE_* values to the app .env file." };
    }

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      return { ok: true };
    } catch (e: any) {
      const code: string = e?.code ?? "";
      console.error("[Auth] password reset error:", code, e?.message);
      if (code === "auth/invalid-email") {
        return { ok: false, error: "Please enter a valid email address." };
      }
      if (code === "auth/too-many-requests") {
        return { ok: false, error: "Too many attempts. Please try again later." };
      }
      if (code === "auth/network-request-failed") {
        return { ok: false, error: "Network error. Please check your internet connection and try again." };
      }
      return { ok: false, error: "Could not send a password reset email. Please check your email and try again." };
    }
  }

  async function toggleAdminRole(userId: string) {
    try {
      const ref = doc(db, "users", userId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const current = (snap.data() as User).isAdmin ?? false;
      await updateDoc(ref, { isAdmin: !current });
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isAdmin: !current } : u))
      );
    } catch (e) {
      console.error("toggleAdminRole error", e);
      throw e;
    }
  }

  async function suspendUser(userId: string, suspend: boolean) {
    try {
      await updateDoc(doc(db, "users", userId), { suspended: suspend });
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, suspended: suspend } : u))
      );
    } catch (e) {
      console.error("suspendUser error", e);
      throw e;
    }
  }

  async function deleteUserFromFirestore(userId: string) {
    try {
      await deleteDoc(doc(db, "users", userId));
      setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error("deleteUserFromFirestore error", e);
      throw e;
    }
  }

  async function updateProfilePhoto(photoURL: string) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.id), { photoURL, updatedAt: new Date().toISOString() });
      setUser((prev) => prev ? { ...prev, photoURL } : prev);
    } catch (e) {
      console.error("updateProfilePhoto error", e);
      throw e;
    }
  }

  async function updateProfileName(name: string, phone: string, email: string, password?: string) {
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) throw new Error("Name cannot be empty");
    if (!trimmedEmail) throw new Error("Email cannot be empty");

    const emailChanged = trimmedEmail !== user.email.toLowerCase();
    const firebaseUser = auth?.currentUser;
    if (emailChanged && (!firebaseUser || !password)) {
      throw new Error("Enter your current password to confirm the email change.");
    }

    try {
      const profileRef = doc(db, "users", user.id);
      const updatedAt = new Date().toISOString();
      await updateDoc(profileRef, { name: trimmedName, phone: trimmedPhone, email: trimmedEmail, updatedAt });

      if (emailChanged && firebaseUser) {
        try {
          await reauthenticateWithCredential(
            firebaseUser,
            EmailAuthProvider.credential(firebaseUser.email ?? user.email, password!)
          );
          await updateEmail(firebaseUser, trimmedEmail);
        } catch (authError) {
          try {
            await updateDoc(profileRef, {
              name: user.name,
              phone: user.phone,
              email: user.email,
              updatedAt: new Date().toISOString(),
            });
          } catch (rollbackError) {
            console.error("updateProfileName email rollback failed", rollbackError);
            throw new Error("Email authentication failed and the profile email could not be restored. Contact support.");
          }
          throw authError;
        }
      }

      setUser((prev) => prev ? { ...prev, name: trimmedName, phone: trimmedPhone, email: trimmedEmail } : prev);
    } catch (e) {
      console.error("updateProfileName error", e);
      throw e;
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setAllUsers([]);
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
        allUsersLoading,
        allUsersError,
        loading,
        locationGranted,
        emailVerificationExpiresAt,
        emailVerificationResendAt,
        login,
        signup,
        resendEmailVerificationOtp,
        verifyEmailOtp,
        resetPassword,
        logout,
        setLocationGranted,
        updateUserStats,
        updateProfilePhoto,
        updateProfileName,
        toggleAdminRole,
        suspendUser,
        deleteUserFromFirestore,
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
