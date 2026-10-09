import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAnnouncements } from "@/context/AnnouncementContext";
import { useColors } from "@/hooks/useColors";

export default function CommunityUpdatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { announcements, loading, error } = useAnnouncements();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as any);
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <LinearGradient colors={["#0F2747", "#2563EB", "#0D9488"]} style={styles.hero}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.heroCopy}>
          <View style={styles.heroEyebrow}>
            <Feather name="shield" size={13} color="#99F6E4" />
            <Text style={styles.heroEyebrowText}>HELPCHAIN COMMUNITY</Text>
          </View>
          <Text style={styles.title}>Community Updates</Text>
          <Text style={styles.subtitle}>Official notices and good news from your community.</Text>
        </View>
        <View pointerEvents="none" style={styles.heroOrb} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : error ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={24} color="#EF4444" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Updates unavailable</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.emptyIcon}>
              <Feather name="inbox" size={24} color="#2563EB" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No official updates yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>New community notices will appear here.</Text>
          </View>
        ) : (
          announcements.map((announcement) => {
            const date = new Date(announcement.createdAt);
            const dateLabel = Number.isNaN(date.getTime())
              ? ""
              : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

            return (
              <View
                key={announcement.id}
                style={[styles.update, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.updateMeta}>
                  <Text style={[styles.category, categoryStyle(announcement.category)]}>{announcement.category.toUpperCase()}</Text>
                  <Text style={[styles.date, { color: colors.mutedForeground }]}>{dateLabel}</Text>
                </View>
                <Text style={[styles.updateTitle, { color: colors.foreground }]}>{announcement.title}</Text>
                <Text
                  style={[styles.body, { color: colors.mutedForeground }]}
                  numberOfLines={expandedId === announcement.id ? undefined : 3}
                >
                  {announcement.body}
                </Text>
                {announcement.imageUrl ? (
                  <Image
                    source={{ uri: announcement.imageUrl }}
                    style={styles.updateImage}
                    resizeMode="cover"
                    accessibilityLabel={`Photo for ${announcement.title}`}
                  />
                ) : null}
                <View style={[styles.authorRow, { borderTopColor: colors.border }]}>
                  <Feather name="shield" size={13} color="#14B8A6" />
                  <Text style={[styles.author, { color: colors.mutedForeground }]}>Posted by {announcement.createdByName}</Text>
                </View>
                <Pressable
                  onPress={() => setExpandedId(expandedId === announcement.id ? null : announcement.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandedId === announcement.id }}
                  style={styles.detailsButton}
                >
                  <Text style={[styles.detailsText, { color: colors.primary }]}>
                    {expandedId === announcement.id ? "Show less" : "View details"}
                  </Text>
                  <Feather
                    name={expandedId === announcement.id ? "chevron-up" : "arrow-right"}
                    size={15}
                    color={colors.primary}
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function categoryStyle(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("food")) return { color: "#0D9488", backgroundColor: "#ECFDF5" };
  if (normalized.includes("cloth")) return { color: "#7C3AED", backgroundColor: "#F5F3FF" };
  if (normalized.includes("donat")) return { color: "#0D9488", backgroundColor: "#ECFDF5" };
  return { color: "#2563EB", backgroundColor: "#EFF6FF" };
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hero: { minHeight: 184, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 24, overflow: "hidden" },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  heroCopy: { gap: 6, marginTop: 12, maxWidth: 560 },
  heroEyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroEyebrowText: { color: "#99F6E4", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  title: { color: "#FFFFFF", fontSize: 27, fontFamily: "Inter_700Bold" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  heroOrb: { position: "absolute", width: 148, height: 148, borderRadius: 74, borderWidth: 22, borderColor: "rgba(255,255,255,0.08)", top: 42, right: -24 },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, gap: 12, paddingBottom: 32 },
  loading: { marginTop: 48 },
  empty: { alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 32, gap: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  update: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12, shadowColor: "#0B1F3A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  updateMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  category: { color: "#2563EB", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4, backgroundColor: "#EFF6FF", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  updateTitle: { fontSize: 17, lineHeight: 23, fontFamily: "Inter_700Bold" },
  body: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  updateImage: { width: "100%", height: 220, borderRadius: 8, backgroundColor: "#F8FAFC" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, paddingTop: 10, marginTop: 2 },
  author: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailsButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingTop: 2, minHeight: 32 },
  detailsText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});