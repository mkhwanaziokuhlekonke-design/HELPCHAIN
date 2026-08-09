/**
 * Role-Based Access Control hooks.
 * Drop one of these at the top of any screen that needs auth or admin access.
 */
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

/**
 * Ensures the current user is authenticated.
 * Redirects to /(auth)/portal if not signed in.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/portal" as any);
    }
  }, [user, loading]);

  return { user, loading };
}

/**
 * Ensures the current user is an authenticated admin.
 * - Not signed in → /(auth)/portal
 * - Signed in but not admin → /(tabs)  (access denied for users)
 */
export function useRequireAdmin() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/portal" as any);
      return;
    }
    if (!user.isAdmin) {
      router.replace("/(tabs)" as any);
    }
  }, [user, loading]);

  return { user, loading, isAdmin: user?.isAdmin ?? false };
}
