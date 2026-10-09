import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CommunityCentersMap } from "@/components/CommunityCentersMap";
import { useColors } from "@/hooks/useColors";

export default function CommunityCentresScreen() {
  const colors = useColors();
  const router = useRouter();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as any);
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <LinearGradient colors={["#0F2747", "#2563EB", "#0D9488"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            hitSlop={10}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={21} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerIcon}>
            <Feather name="map-pin" size={19} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.title}>Community Centres</Text>
        <Text style={styles.subtitle}>Discover trusted places to give back in West Acres.</Text>
        <View pointerEvents="none" style={styles.headerOrb} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CommunityCentersMap />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 170, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22, gap: 8, overflow: "hidden" },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 25, fontFamily: "Inter_700Bold", marginTop: 8 },
  subtitle: { color: "rgba(255,255,255,0.8)", maxWidth: 480, fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  headerOrb: { position: "absolute", width: 130, height: 130, borderRadius: 65, borderWidth: 20, borderColor: "rgba(255,255,255,0.08)", top: 62, right: -20 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 30 },
});