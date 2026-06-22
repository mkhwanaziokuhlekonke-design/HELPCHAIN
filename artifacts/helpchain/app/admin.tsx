import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Image,
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
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useDonations } from "@/context/DonationContext";
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo.jpeg");

type Tab = "overview" | "requests" | "users" | "donations" | "chat";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusColor(status: string, colors: any): string {
  if (status === "open") return colors.success;
  if (status === "accepted") return colors.primary;
  if (status === "completed") return colors.accent;
  return colors.mutedForeground;
}

function categoryIcon(cat: string): string {
  const m: Record<string, string> = {
    emergency: "alert-triangle",
    medical: "heart",
    food: "shopping-bag",
    transport: "truck",
    daily: "home",
    other: "help-circle",
  };
  return m[cat] ?? "help-circle";
}

export default function AdminScreen() {
  const colors = useColors();
  const { allUsers } = useAuth();
  const { requests } = useHelp();
  const { donations, totalRaised } = useDonations();
  const { messages } = useChat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("overview");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const openReqs = requests.filter((r) => r.status === "open").length;
  const emergencyCount = requests.filter((r) => r.isEmergency && r.status === "open").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const acceptedCount = requests.filter((r) => r.status === "accepted").length;
  const totalDonors = [...new Set(donations.map((d) => d.donorId))].length;

  const STATS = [
    { label: "Registered Users", val: allUsers.length, icon: "users", color: colors.primary, bg: colors.secondary },
    { label: "Open Requests", val: openReqs, icon: "list", color: colors.success, bg: "#ECFDF5" },
    { label: "Active Emergencies", val: emergencyCount, icon: "alert-triangle", color: "#DC2626", bg: "#FEF2F2" },
    { label: "Completed", val: completedCount, icon: "check-circle", color: colors.accent, bg: "#F0FDFA" },
    { label: "Total Donations", val: `$${totalRaised}`, icon: "dollar-sign", color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Chat Messages", val: messages.length, icon: "message-circle", color: "#8B5CF6", bg: "#F5F3FF" },
  ];

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "grid" },
    { key: "requests", label: "Requests", icon: "list" },
    { key: "users", label: "Users", icon: "users" },
    { key: "donations", label: "Donations", icon: "dollar-sign" },
    { key: "chat", label: "Chat", icon: "message-circle" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient colors={["#0F172A", "#1E3A8A", "#2563EB"]} style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSub}>Full platform overview</Text>
          </View>
          <View style={[styles.adminTag, { backgroundColor: "#14B8A6" }]}>
            <Feather name="shield" size={11} color="#fff" />
            <Text style={styles.adminTagText}>Admin</Text>
          </View>
        </View>

        {/* Tab bar — horizontal scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Feather name={t.icon as any} size={13} color={tab === t.key ? "#fff" : "rgba(255,255,255,0.5)"} />
              <Text style={[styles.tabText, { color: tab === t.key ? "#fff" : "rgba(255,255,255,0.5)" }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
          <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>PLATFORM STATS</Text>

          <View style={styles.statsGrid}>
            {STATS.map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                  <Feather name={s.icon as any} size={20} color={s.color} />
                </View>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{s.val}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Request breakdown */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Request Status Breakdown</Text>
            {[
              { label: "Open", count: openReqs, color: colors.success },
              { label: "Accepted", count: acceptedCount, color: colors.primary },
              { label: "Completed", count: completedCount, color: colors.accent },
            ].map((item) => (
              <View key={item.label} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: item.color,
                        width: requests.length > 0 ? `${(item.count / requests.length) * 100}%` : "0%",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barCount, { color: colors.foreground }]}>{item.count}</Text>
              </View>
            ))}
          </View>

          {/* Donation summary */}
          <LinearGradient colors={["#F59E0B", "#D97706"]} style={styles.donationSummaryCard}>
            <View style={styles.donationSummaryRow}>
              <View>
                <Text style={styles.donationSummaryLabel}>Total Raised</Text>
                <Text style={styles.donationSummaryAmount}>${totalRaised}</Text>
              </View>
              <View style={styles.donationSummaryRight}>
                <Text style={styles.donationSummaryLabel}>Donors</Text>
                <Text style={styles.donationSummaryCount}>{totalDonors}</Text>
              </View>
              <View style={[styles.donationIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Feather name="dollar-sign" size={28} color="#fff" />
              </View>
            </View>
            <Text style={styles.donationSummaryRecent}>
              Latest: {donations[0]?.donorName ?? "—"} donated ${donations[0]?.amount ?? 0} · {donations[0] ? timeAgo(donations[0].createdAt) : ""}
            </Text>
          </LinearGradient>

          {/* Recent activity feed */}
          <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>LIVE ACTIVITY FEED</Text>

          {[
            ...requests.slice(0, 3).map((r) => ({
              id: r.id,
              type: "request" as const,
              icon: r.isEmergency ? "alert-triangle" : "list",
              iconColor: r.isEmergency ? "#DC2626" : colors.primary,
              iconBg: r.isEmergency ? "#FEF2F2" : colors.secondary,
              title: r.title,
              sub: `${r.requesterName} · ${r.status}`,
              time: r.updatedAt,
            })),
            ...donations.slice(0, 2).map((d) => ({
              id: d.id,
              type: "donation" as const,
              icon: "dollar-sign",
              iconColor: "#D97706",
              iconBg: "#FFFBEB",
              title: `${d.donorName} donated $${d.amount}`,
              sub: d.message ?? "No message",
              time: d.createdAt,
            })),
            ...messages.slice(-2).reverse().map((m) => ({
              id: m.id,
              type: "chat" as const,
              icon: "message-circle",
              iconColor: "#8B5CF6",
              iconBg: "#F5F3FF",
              title: m.userName,
              sub: m.text,
              time: m.createdAt,
            })),
          ]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .map((item) => (
              <View key={item.id} style={[styles.activityRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.activityIcon, { backgroundColor: item.iconBg }]}>
                  <Feather name={item.icon as any} size={16} color={item.iconColor} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.activityTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.activitySub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.sub}</Text>
                </View>
                <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>{timeAgo(item.time)}</Text>
              </View>
            ))}
        </ScrollView>
      )}

      {/* ── REQUESTS ── */}
      {tab === "requests" && (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
              {requests.length} TOTAL REQUEST{requests.length !== 1 ? "S" : ""}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/request/${item.id}` as any)}
              style={[styles.requestRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.reqIconBox, { backgroundColor: item.isEmergency ? "#FEF2F2" : colors.secondary }]}>
                <Feather name={categoryIcon(item.category) as any} size={18} color={item.isEmergency ? "#DC2626" : colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.requestTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.requestMeta, { color: colors.mutedForeground }]}>
                  {item.requesterName} · {timeAgo(item.createdAt)}
                </Text>
                {item.helperName && (
                  <Text style={[styles.requestHelper, { color: colors.accent }]}>
                    Helper: {item.helperName}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status, colors) + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status, colors) }]}>
                    {item.status}
                  </Text>
                </View>
                {item.isEmergency && (
                  <View style={[styles.emergencyBadge, { backgroundColor: "#FEF2F2" }]}>
                    <Text style={[styles.emergencyBadgeText, { color: "#DC2626" }]}>EMERGENCY</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}

      {/* ── USERS ── */}
      {tab === "users" && (
        <FlatList
          data={allUsers}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
              {allUsers.length} REGISTERED USER{allUsers.length !== 1 ? "S" : ""}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.userRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <UserAvatar name={item.name} size={50} isAdmin={item.isAdmin} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.userNameRow}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.isAdmin && (
                    <View style={[styles.adminPill, { backgroundColor: "#14B8A6" + "20" }]}>
                      <Feather name="shield" size={9} color="#14B8A6" />
                      <Text style={[styles.adminPillText, { color: "#14B8A6" }]}>Admin</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{item.email}</Text>
                <Text style={[styles.userPhone, { color: colors.mutedForeground }]}>{item.phone}</Text>
                <View style={styles.userStatsRow}>
                  <View style={styles.userStatChip}>
                    <Feather name="list" size={10} color={colors.primary} />
                    <Text style={[styles.userStatText, { color: colors.primary }]}>{item.requestsCreated} requests</Text>
                  </View>
                  <View style={styles.userStatChip}>
                    <Feather name="heart" size={10} color={colors.accent} />
                    <Text style={[styles.userStatText, { color: colors.accent }]}>{item.helpOffered} helped</Text>
                  </View>
                  <View style={styles.userStatChip}>
                    <Feather name="dollar-sign" size={10} color="#D97706" />
                    <Text style={[styles.userStatText, { color: "#D97706" }]}>
                      ${donations.filter((d) => d.donorId === item.id).reduce((s, d) => s + d.amount, 0)} donated
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* ── DONATIONS ── */}
      {tab === "donations" && (
        <FlatList
          data={donations}
          keyExtractor={(d) => d.id}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          ListHeaderComponent={
            <>
              <LinearGradient colors={["#F59E0B", "#D97706"]} style={styles.donationHeader}>
                <Feather name="dollar-sign" size={32} color="#fff" />
                <View>
                  <Text style={styles.donationHeaderAmount}>${totalRaised}</Text>
                  <Text style={styles.donationHeaderLabel}>Total raised from {donations.length} donations</Text>
                </View>
              </LinearGradient>
              <Text style={[styles.listHeader, { color: colors.mutedForeground, marginTop: 4 }]}>
                {donations.length} DONATION{donations.length !== 1 ? "S" : ""}
              </Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={[styles.donationRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.donationAmtBox, { backgroundColor: "#FFFBEB" }]}>
                <Text style={[styles.donationAmt, { color: "#D97706" }]}>${item.amount}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.donationName, { color: colors.foreground }]}>{item.donorName}</Text>
                {item.message ? (
                  <Text style={[styles.donationMsg, { color: colors.mutedForeground }]} numberOfLines={2}>
                    "{item.message}"
                  </Text>
                ) : (
                  <Text style={[styles.donationMsg, { color: colors.muted }]}>No message</Text>
                )}
                <Text style={[styles.donationTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="dollar-sign" size={40} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No donations yet</Text>
            </View>
          }
        />
      )}

      {/* ── CHAT ── */}
      {tab === "chat" && (
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
              {messages.length} COMMUNITY MESSAGE{messages.length !== 1 ? "S" : ""}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.chatRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <UserAvatar name={item.userName} size={38} isAdmin={item.userId === "u0"} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.chatNameRow}>
                  <Text style={[styles.chatName, { color: colors.foreground }]}>{item.userName}</Text>
                  {item.userId === "u0" && (
                    <View style={[styles.adminPill, { backgroundColor: "#14B8A6" + "20" }]}>
                      <Text style={[styles.adminPillText, { color: "#14B8A6" }]}>Admin</Text>
                    </View>
                  )}
                  <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={[styles.chatText, { color: colors.mutedForeground }]} numberOfLines={3}>{item.text}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="message-circle" size={40} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No messages yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 0 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerLogo: { width: 36, height: 36, borderRadius: 10 },
  headerTitleGroup: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  adminTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  adminTagText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tabScroll: { marginBottom: 0 },
  tabRow: { flexDirection: "row", gap: 4, paddingBottom: 0 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#fff" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  scroll: { padding: 14, gap: 10 },
  sectionHead: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginTop: 4,
    marginLeft: 2,
  },
  listHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 2,
  },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "47.5%",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  card: {
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 70 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  barCount: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 22, textAlign: "right" },

  donationSummaryCard: {
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  donationSummaryRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  donationSummaryLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_500Medium" },
  donationSummaryAmount: { color: "#fff", fontSize: 30, fontFamily: "Inter_700Bold" },
  donationSummaryRight: { flex: 1 },
  donationSummaryCount: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  donationIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  donationSummaryRecent: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activitySub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  activityTime: { fontSize: 11, fontFamily: "Inter_400Regular" },

  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  reqIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  requestTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  requestMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  requestHelper: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  emergencyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emergencyBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  userRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userPhone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userStatsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  userStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  userStatText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  adminPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  donationHeader: {
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 4,
  },
  donationHeaderAmount: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff" },
  donationHeaderLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  donationRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  donationAmtBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  donationAmt: { fontSize: 18, fontFamily: "Inter_700Bold" },
  donationName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  donationMsg: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  donationTime: { fontSize: 11, fontFamily: "Inter_400Regular" },

  chatRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  chatNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chatName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chatTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  chatText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
