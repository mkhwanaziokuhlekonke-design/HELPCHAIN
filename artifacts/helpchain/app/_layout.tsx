import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotifToast } from "@/components/NotifToast";
import { AnnouncementProvider } from "@/context/AnnouncementContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { DonationProvider } from "@/context/DonationContext";
import { DonationInformationProvider } from "@/context/DonationInformationContext";
import { EmergencyAlertProvider } from "@/context/EmergencyAlertContext";
import { HelpProvider } from "@/context/HelpContext";
import { LocationProvider } from "@/context/LocationContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { OrganisationProvider } from "@/context/OrganisationContext";
import { PresenceProvider } from "@/context/PresenceContext";
import { CommunityCentreProvider } from "@/context/CommunityCentreContext";
import { ReportProvider } from "@/context/ReportContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => {
    const isAuthRoute = segments[0] === "(auth)";
    const authScreen = isAuthRoute ? segments[1] : undefined;
    const isSplashRoute = pathname === "/";
    if (loading) return;
    if (!user) {
      if ((!isAuthRoute && !isSplashRoute) || authScreen === "verify-email") {
        router.replace("/(auth)/portal" as any);
      }
      return;
    }
    if (isAuthRoute && authScreen === "admin-login") {
      if (!user.isAdmin) return;
      router.replace(user.emailVerified === false ? "/(auth)/verify-email" as any : "/admin" as any);
      return;
    }
    if (user.emailVerified === false) {
      if (authScreen !== "verify-email") router.replace("/(auth)/verify-email" as any);
      return;
    }
    if (isSplashRoute || (isAuthRoute && authScreen !== "location")) {
      router.replace(user.isAdmin ? "/admin" as any : "/(tabs)" as any);
      return;
    }
    if (user.isAdmin && segments[0] === "(tabs)") {
      router.replace("/admin" as any);
    }
  }, [loading, user, pathname, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="emergency-assistance" options={{ headerShown: false }} />
      <Stack.Screen name="donation" options={{ headerShown: false }} />
      <Stack.Screen name="donation/register" options={{ headerShown: false }} />
      <Stack.Screen name="donation/centres" options={{ headerShown: false }} />
      <Stack.Screen name="donation/confirm" options={{ headerShown: false }} />
      <Stack.Screen name="donation/my-donations" options={{ headerShown: false }} />
      <Stack.Screen name="community-centres" options={{ headerShown: false }} />
      <Stack.Screen name="community-updates" options={{ headerShown: false }} />
      <Stack.Screen name="request/new" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="request/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <HelpProvider>
              <ChatProvider>
                <DonationProvider>
                  <DonationInformationProvider>
                    <AnnouncementProvider>
                      <OrganisationProvider>
                        <CommunityCentreProvider>
                          <ReportProvider>
                            <EmergencyAlertProvider>
                              <NotificationProvider>
                                <PresenceProvider>
                                  <LocationProvider>
                                    <GestureHandlerRootView style={{ flex: 1 }}>
                                      <KeyboardProvider>
                                        <RootLayoutNav />
                                      </KeyboardProvider>
                                      <NotifToast />
                                    </GestureHandlerRootView>
                                  </LocationProvider>
                                </PresenceProvider>
                              </NotificationProvider>
                            </EmergencyAlertProvider>
                          </ReportProvider>
                        </CommunityCentreProvider>
                      </OrganisationProvider>
                    </AnnouncementProvider>
                  </DonationInformationProvider>
                </DonationProvider>
              </ChatProvider>
            </HelpProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
