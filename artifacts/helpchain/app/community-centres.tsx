import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommunityCentersMap } from "@/components/CommunityCentersMap";
import { useColors } from "@/hooks/useColors";

export default function CommunityCentresScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.card }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          hitSlop={10}
          style={[styles.backButton, { backgroundColor: colors.background }]}
        >
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>Community Centre</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Find a place to give back in West Acres
          </Text>
        </View>
      </View>

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
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 30 },
});