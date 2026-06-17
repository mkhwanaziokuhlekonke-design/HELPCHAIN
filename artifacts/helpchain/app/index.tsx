import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

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
        <View style={styles.iconWrapper}>
          <Feather name="shield" size={72} color="#fff" />
          <View style={styles.chainDot} />
        </View>

        <Text style={styles.title}>HelpChain</Text>
        <Text style={styles.tagline}>Help together. grow together.</Text>

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
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 8,
  },
  chainDot: {
    position: "absolute",
    bottom: 18,
    right: 18,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#14B8A6",
    borderWidth: 2,
    borderColor: "#fff",
  },
  title: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.3,
  },
  loader: {
    marginTop: 32,
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
