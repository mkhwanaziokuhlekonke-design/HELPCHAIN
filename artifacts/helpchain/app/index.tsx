import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const logo = require("@/assets/images/logo.jpeg");

export default function SplashIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
          router.replace("/(tabs)" as any);
        } else {
          router.replace("/(auth)/portal" as any);
        }
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient colors={["#1F2937", "#2563EB", "#0EA5E9"]} style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        </View>

        <View style={styles.loader}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20 }]}>
        <Text style={styles.footerText}>Powered by your community</Text>
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
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 220,
    height: 220,
    borderRadius: 40,
  },
  loader: {
    marginTop: 24,
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
