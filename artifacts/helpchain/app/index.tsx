import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { HelpChainLogo } from "@/components/HelpChainLogo";

export default function SplashIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
          if (user.emailVerified === false) {
            router.replace("/(auth)/verify-email" as any);
          } else {
            router.replace(user.isAdmin ? "/admin" as any : "/(tabs)" as any);
          }
        } else {
          router.replace("/(auth)/portal" as any);
        }
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient colors={["#0F2747", "#2563EB", "#2563EB"]} style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <HelpChainLogo width={300} height={184} light />
        </View>

        <View style={styles.loader}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
        </View>
      </View>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  logoWrapper: {
    width: 300,
    height: 184,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    marginTop: 24,
  },
});
