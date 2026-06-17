import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryBadge } from "@/components/CategoryBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

type Tab = "overview" | "requests" | "users";

export default function AdminScreen() {
  const colors = useColors();
  const { allUsers } = useAuth();
  const { requests } = useHelp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("overview");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const totalRequests = requests.length;
  const openRequests = requests.filter((r) => r.status === "open").length;
  const emergencyCount = requests.filter((r) => r.isEmergency && r.status === "open").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const acceptedCount = requests.filter((r) => r.status === "accepted").length;

  const STATS = [
    { label: "Total Users", val: allUsers.length, icon: "users", color: colors.primary, bg: colors.secondary },
    { label: "Open Requests", val: openRequests, icon: "list", color: colors.success, bg: "#ECFDF5" },
    { label: "Emergencies", val: emergencyCount, icon: "alert-triangle", color: colors.destructive, bg: "#FEF2F2" },
    { label: "Completed", val: completedCount, icon: "check-circle", color: colors.accent, bg: colors.tealLight },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "requests", label: "Requests" },
    { key: "users", label: "Users" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#1F2937", "#2563EB"]} style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
          </View>
          <View style={[styles.adminTag, { backgroundColor: colors.accent }]}>
            <Feather name="shield" size={12} color="#fff" />
            <Text style={styles.adminTagText}>Admin</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, { color: tab === t.key ? "#fff" : "rgba(255,255,255,0.55)" }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {tab === "overview" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
          <View style={styles.statsGrid}>
            {STATS.map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                  <Feather name={s.icon as any} size={22} color={s.color} />
                </View>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{s.val}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.progressTitle, { color: colors.foreground }]}>Request Status Breakdown</Text>
            {[
              { label: "Open", count: openRequests, color: colors.success },
              { label: "Accepted", count: acceptedCount, color: colors.primary },
              { label: "Completed", count: completedCount, color: colors.accent },
            ].map((item) => (
              <View key={item.label} style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: item.color,
                        width: totalRequests > 0 ? `${(item.count / totalRequests) * 100}%` : "0%",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressCount, { color: colors.foreground }]}>{item.count}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>RECENT ACTIVITY</Text>
          {requests.slice(0, 5).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/request/${r.id}` as any)}
              style={[styles.activityItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <CategoryBadge category={r.category} isEmergency={r.isEmergency} size="sm" />
              <Text style={[styles.activityTitle, { color: colors.foreground }]} numberOfLines={1}>{r.title}</Text>
              <Text style={[styles.activityStatus, { color: colors.mutedForeground }]}>{r.status}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {tab === "requests" && (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/request/${item.id}` as any)}
              style={[styles.requestRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.requestRowTop}>
                  <CategoryBadge category={item.category} isEmergency={item.isEmergency} size="sm" />
                </View>
                <Text style={[styles.requestTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.requestBy, { color: colors.mutedForeground }]}>by {item.requesterName} · {item.status}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}

      {tab === "users" && (
        <FlatList
          data={allUsers}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          renderItem={({ item }) => (
            <View style={[styles.userRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <UserAvatar name={item.name} size={44} isAdmin={item.isAdmin} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.userNameRow}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.isAdmin && (
                    <View style={[styles.adminPill, { backgroundColor: colors.accent + "20" }]}>
                      <Text style={[styles.adminPillText, { color: colors.accent }]}>Admin</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{item.email}</Text>
                <Text style={[styles.userStats, { color: colors.mutedForeground }]}>
                  {item.requestsCreated} requests · {item.helpOffered} helped
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  adminTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminTagText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tabRow: { flexDirection: "row", gap: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#fff" },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 10 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47.5%", borderRadius: 14, padding: 16, alignItems: "flex-start", gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  progressCard: { borderRadius: 14, padding: 16, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  progressTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 68 },
  progressBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressCount: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 24, textAlign: "right" },
  sectionHead: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginTop: 4, marginLeft: 2 },
  activityItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  activityTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  activityStatus: { fontSize: 12, fontFamily: "Inter_400Regular" },
  requestRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  requestRowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  requestTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  requestBy: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userRow: { flexDirection: "row", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  adminPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  adminPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  userStats: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
