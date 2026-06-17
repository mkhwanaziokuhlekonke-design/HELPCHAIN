import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LocationScreen() {
  const colors = useColors();
  const { setLocationGranted } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleAllow() {
    setLoading(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        await setLocationGranted(status === "granted");
      } else {
        if ("geolocation" in navigator) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              () => resolve(),
              { timeout: 5000 }
            );
          });
        }
        await setLocationGranted(true);
      }
    } catch {
      await setLocationGranted(false);
    } finally {
      setLoading(false);
      router.replace("/(tabs)" as any);
    }
  }

  async function handleSkip() {
    await setLocationGranted(false);
    router.replace("/(tabs)" as any);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <LinearGradient
        colors={["#1B4FD8", "#EA580C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Feather name="map-pin" size={60} color="#fff" />
      </LinearGradient>

      <View style={styles.textContent}>
        <Text style={[styles.title, { color: colors.foreground }]}>Enable Location</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          HelpChain uses your location to show nearby help requests and share your position during emergencies.
        </Text>

        <View style={styles.featureList}>
          {[
            { icon: "radio", text: "See requests near you" },
            { icon: "alert-triangle", text: "Share location in emergencies" },
            { icon: "navigation", text: "Get directions to help others" },
          ].map((item) => (
            <View key={item.text} style={[styles.featureRow, { backgroundColor: colors.secondary }]}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name={item.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.foreground }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: bottomPad + 24 }]}>
        <Pressable
          onPress={handleAllow}
          disabled={loading}
          style={({ pressed }) => [styles.allowBtn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="map-pin" size={18} color="#fff" />
              <Text style={styles.allowText}>Allow Location Access</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    marginBottom: 32,
  },
  textContent: {
    flex: 1,
    gap: 16,
    alignSelf: "stretch",
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    textAlign: "center",
  },
  featureList: {
    gap: 10,
    marginTop: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  actions: {
    alignSelf: "stretch",
    gap: 12,
    paddingTop: 24,
  },
  allowBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  allowText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  skipBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
