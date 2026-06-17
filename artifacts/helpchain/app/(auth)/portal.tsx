import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo.jpeg");

export default function PortalScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={["#1F2937", "#2563EB", "#0EA5E9"]}
        style={[styles.header, { paddingTop: topPad }]}
      >
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        <Text style={styles.slogan}>Help together. Grow together.</Text>
      </LinearGradient>

      <View style={[styles.body, { paddingBottom: bottomPad }]}>
        <Text style={[styles.chooseTitle, { color: colors.foreground }]}>
          How would you like to continue?
        </Text>
        <Text style={[styles.chooseSub, { color: colors.mutedForeground }]}>
          Select your account type to get started
        </Text>

        <Pressable
          onPress={() => router.push("/(auth)/login" as any)}
          style={({ pressed }) => [styles.portalCard, { opacity: pressed ? 0.93 : 1 }]}
        >
          <LinearGradient colors={["#2563EB", "#1D4ED8"]} style={styles.cardGrad}>
            <View style={styles.cardIconWrap}>
              <Feather name="user" size={36} color="#fff" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Continue as User</Text>
              <Text style={styles.cardSub}>
                Request help, offer support, and join your community
              </Text>
            </View>
            <View style={styles.cardArrow}>
              <Feather name="arrow-right" size={22} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/admin-login" as any)}
          style={({ pressed }) => [styles.portalCard, { opacity: pressed ? 0.93 : 1 }]}
        >
          <LinearGradient colors={["#0F766E", "#14B8A6"]} style={styles.cardGrad}>
            <View style={styles.cardIconWrap}>
              <Feather name="settings" size={36} color="#fff" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Admin Portal</Text>
              <Text style={styles.cardSub}>
                Manage requests, users, and monitor platform activity
              </Text>
            </View>
            <View style={styles.cardArrow}>
              <Feather name="arrow-right" size={22} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.infoBox}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Admin access is restricted to authorised personnel only
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
    gap: 10,
  },
  logoImage: {
    width: 160,
    height: 160,
    borderRadius: 32,
    marginTop: 12,
    marginBottom: 4,
  },
  slogan: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  body: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  chooseTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 8,
  },
  chooseSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 4,
  },
  portalCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  cardGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
    minHeight: 100,
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 17,
  },
  cardArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    marginTop: 4,
    justifyContent: "center",
  },
  infoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    flex: 1,
  },
});
