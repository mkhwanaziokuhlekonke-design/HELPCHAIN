import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HelpChainLogo } from "@/components/HelpChainLogo";

export default function PortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 32 : insets.top;

  return (
    <LinearGradient colors={["#0F2747", "#2563EB"]} style={styles.page}>
      <View style={[styles.content, { paddingTop: topPad + 24, paddingBottom: Math.max(insets.bottom, 24) + 24 }]}>
        <View style={styles.brand}>
          <HelpChainLogo width={240} height={148} light />
          <Text style={styles.title}>Welcome to HelpChain</Text>
          <Text style={styles.subtitle}>Help together. Grow together.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/login" as any)}
            style={({ pressed }) => [styles.button, styles.userButton, pressed && styles.pressed]}
          >
            <Feather name="log-in" size={18} color="#2563EB" />
            <Text style={styles.userButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/admin-login" as any)}
            style={({ pressed }) => [styles.button, styles.adminButton, pressed && styles.pressed]}
          >
            <Feather name="shield" size={18} color="#FFFFFF" />
            <Text style={styles.adminButtonText}>Sign In as Admin</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28 },
  brand: { alignItems: "center", justifyContent: "center", flex: 1, gap: 10 },
  title: { color: "#FFFFFF", fontSize: 25, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 10 },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  actions: { width: "100%", maxWidth: 420, gap: 12 },
  button: { minHeight: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  userButton: { backgroundColor: "#FFFFFF" },
  adminButton: { backgroundColor: "rgba(15,39,71,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  pressed: { opacity: 0.8 },
  userButtonText: { color: "#2563EB", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  adminButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
