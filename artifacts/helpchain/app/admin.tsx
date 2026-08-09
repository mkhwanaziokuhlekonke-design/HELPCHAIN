import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path, Polyline, Line as SvgLine, Text as SvgText, G } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useDonations } from "@/context/DonationContext";
import { useHelp } from "@/context/HelpContext";

const logo = require("@/assets/images/logo.jpeg");

const DRAWER_WIDTH = 240;
const BLUE_DARK = "#1E3A8A";
const BLUE_MID = "#1D4ED8";
const BLUE_LIGHT = "#2563EB";
const BG = "#F1F5F9";
const CARD = "#FFFFFF";

type Section =
  | "dashboard"
  | "users"
  | "requests"
  | "donations"
  | "chat"
  | "reports"
  | "location"
  | "analytics"
  | "settings";

const NAV_ITEMS: { key: Section; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "users", label: "Users", icon: "users" },
  { key: "requests", label: "Requests", icon: "list" },
  { key: "donations", label: "Donations", icon: "dollar-sign" },
  { key: "chat", label: "Community Chat", icon: "message-circle" },
  { key: "reports", label: "Reports & Complaints", icon: "flag" },
  { key: "location", label: "Location Monitoring", icon: "map-pin" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-2" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const CHART_POINTS = {
  requests: [200, 350, 480, 600, 780, 900, 1000],
  donations: [80, 180, 300, 410, 540, 660, 760],
  users: [50, 140, 240, 350, 460, 540, 600],
  labels: ["May 1", "May 6", "May 11", "May 16", "May 21", "May 26", "May 31"],
};

const PENDING_REPORTS = [
  { id: "rep1", title: "Inappropriate Content", desc: "Reported in General Chat", time: "10 min ago", color: "#EF4444" },
  { id: "rep2", title: "Spam User", desc: "User: john_doe123", time: "25 min ago", color: "#EF4444" },
  { id: "rep3", title: "Harassment", desc: "Reported in Food Support", time: "45 min ago", color: "#F59E0B" },
  { id: "rep4", title: "Fake Request", desc: "Request ID: REQ12345", time: "1 hr ago", color: "#F59E0B" },
];

const SYSTEM_SUMMARY = [
  { label: "Total Categories", val: "24" },
  { label: "Verified Volunteers", val: "1,256" },
  { label: "Messages (This Month)", val: "8,745" },
  { label: "App Version", val: "1.2.3" },
  { label: "Total Downloads", val: "25,680" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getStatusColor(status: string): string {
  if (status === "open") return "#10B981";
  if (status === "accepted") return "#F59E0B";
  if (status === "completed") return "#14B8A6";
  return "#9CA3AF";
}
function getStatusLabel(status: string): string {
  if (status === "open") return "New";
  if (status === "accepted") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildPath(data: number[], w: number, h: number, maxY: number): string {
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / maxY) * (h - 20),
  }));
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${cx} ${pts[i - 1].y}, ${cx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function LineChart({ width }: { width: number }) {
  const H = 160;
  const W = width - 40;
  const maxY = 1200;
  const rPath = buildPath(CHART_POINTS.requests, W, H, maxY);
  const dPath = buildPath(CHART_POINTS.donations, W, H, maxY);
  const uPath = buildPath(CHART_POINTS.users, W, H, maxY);

  const yLabels = [0, 400, 800, 1200];

  return (
    <View style={{ paddingLeft: 8, paddingRight: 4 }}>
      <Svg width={W + 16} height={H + 30}>
        {yLabels.map((val) => {
          const y = H - (val / maxY) * (H - 20) + 2;
          return (
            <G key={val}>
              <SvgLine x1={0} y1={y} x2={W} y2={y} stroke="#E2E8F0" strokeWidth={1} />
              <SvgText x={-2} y={y + 4} fontSize={9} fill="#94A3B8" textAnchor="end">{val === 0 ? "0" : val >= 1000 ? `${val / 1000}k` : val}</SvgText>
            </G>
          );
        })}
        <Path d={rPath} fill="none" stroke="#3B82F6" strokeWidth={2} />
        <Path d={dPath} fill="none" stroke="#14B8A6" strokeWidth={2} />
        <Path d={uPath} fill="none" stroke="#A78BFA" strokeWidth={2} />
        {CHART_POINTS.requests.map((v, i) => (
          <Circle
            key={`r${i}`}
            cx={(i / (CHART_POINTS.requests.length - 1)) * W}
            cy={H - (v / maxY) * (H - 20)}
            r={3}
            fill="#3B82F6"
          />
        ))}
        {CHART_POINTS.donations.map((v, i) => (
          <Circle
            key={`d${i}`}
            cx={(i / (CHART_POINTS.donations.length - 1)) * W}
            cy={H - (v / maxY) * (H - 20)}
            r={3}
            fill="#14B8A6"
          />
        ))}
        {CHART_POINTS.users.map((v, i) => (
          <Circle
            key={`u${i}`}
            cx={(i / (CHART_POINTS.users.length - 1)) * W}
            cy={H - (v / maxY) * (H - 20)}
            r={3}
            fill="#A78BFA"
          />
        ))}
        {CHART_POINTS.labels.filter((_, i) => i % 2 === 0).map((label, idx) => {
          const actualIdx = idx * 2;
          const x = (actualIdx / (CHART_POINTS.labels.length - 1)) * W;
          return (
            <SvgText key={label} x={x} y={H + 18} fontSize={8} fill="#94A3B8" textAnchor="middle">
              {label.replace("May ", "")}
            </SvgText>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 6, paddingLeft: 8 }}>
        {[
          { color: "#3B82F6", label: "Requests" },
          { color: "#14B8A6", label: "Donations" },
          { color: "#A78BFA", label: "Users" },
        ].map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 20, height: 3, backgroundColor: s.color, borderRadius: 2 }} />
            <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AdminMapView() {
  const mapUrl = "https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.69,-73.97,40.73&layer=mapnik";
  if (Platform.OS === "web") {
    return (
      <iframe
        src={mapUrl}
        style={{ width: "100%", height: 180, border: "none", borderRadius: 8 } as any}
        title="Live Activity Map"
      />
    );
  }
  return (
    <View style={{ height: 180, backgroundColor: "#DBEAFE", borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 8 }}>
      <Feather name="map" size={36} color="#3B82F6" />
      <Text style={{ color: "#1D4ED8", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Live Activity Map</Text>
      <Text style={{ color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" }}>Showing real-time requests & volunteers</Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, allUsers, loading, logout, toggleAdminRole, suspendUser, deleteUserFromFirestore } = useAuth();
  const { requests } = useHelp();
  const { donations, totalItems } = useDonations();
  const { messages } = useChat();

  const [section, setSection] = useState<Section>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [userSearch, setUserSearch] = useState("");
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // ── Admin route guard ────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/portal" as any);
    } else if (!user.isAdmin) {
      router.replace("/(tabs)" as any);
    }
  }, [user, loading]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerX, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [drawerX, overlayOpacity]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerX, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  }, [drawerX, overlayOpacity]);

  const navTo = useCallback(
    (s: Section) => {
      setSection(s);
      closeDrawer();
    },
    [closeDrawer]
  );

  // ── Guard render ─────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={BLUE_LIGHT} />
      </View>
    );
  }
  if (!user.isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <Feather name="shield-off" size={48} color="#EF4444" />
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E293B", textAlign: "center" }}>
          Access Denied
        </Text>
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" }}>
          You need admin privileges to access this dashboard.
        </Text>
        <Pressable
          onPress={() => router.replace("/(tabs)" as any)}
          style={{ backgroundColor: BLUE_LIGHT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 56 : insets.top;

  const activeRequests = requests.filter((r) => r.status === "open").length;
  const completedRequests = requests.filter((r) => r.status === "completed").length;

  const STATS = [
    { label: "Total Users", val: allUsers.length.toString(), icon: "user", iconBg: "#3B82F6", iconFg: "#fff", trend: "+12.5%", up: true },
    { label: "Active Requests", val: activeRequests.toString(), icon: "activity", iconBg: "#10B981", iconFg: "#fff", trend: "+8.3%", up: true },
    { label: "Completed", val: completedRequests.toString(), icon: "check-circle", iconBg: "#8B5CF6", iconFg: "#fff", trend: "+15.7%", up: true },
    { label: "Items Donated", val: totalItems.toString(), icon: "gift", iconBg: "#F59E0B", iconFg: "#fff", trend: "+10.2%", up: true },
    { label: "Community Groups", val: "86", icon: "users", iconBg: "#EC4899", iconFg: "#fff", trend: "+6.4%", up: true },
    { label: "Pending Reports", val: PENDING_REPORTS.length.toString(), icon: "alert-circle", iconBg: "#EF4444", iconFg: "#fff", trend: "3.2%", up: false },
  ];

  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── TOP HEADER ── */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: CARD }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={openDrawer} style={styles.iconBtn}>
            <Feather name="menu" size={22} color="#1E293B" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSub}>Welcome back, {user?.name ?? "Admin"}!</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.iconBtn}>
              <Feather name="search" size={20} color="#64748B" />
            </Pressable>
            <Pressable style={[styles.iconBtn, { position: "relative" }]}>
              <Feather name="bell" size={20} color="#64748B" />
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>3</Text>
              </View>
            </Pressable>
            <View style={styles.dateBox}>
              <Feather name="calendar" size={12} color="#64748B" />
              <Text style={styles.dateText}>{dateStr} | {timeStr}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── MAIN CONTENT ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }}>
        {/* STATS ROW */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
        >
          {STATS.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: CARD }]}>
              <View style={[styles.statIconCircle, { backgroundColor: s.iconBg }]}>
                <Feather name={s.icon as any} size={18} color={s.iconFg} />
              </View>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <View style={styles.statTrend}>
                <Feather
                  name={s.up ? "trending-up" : "trending-down"}
                  size={10}
                  color={s.up ? "#10B981" : "#EF4444"}
                />
                <Text style={[styles.statTrendText, { color: s.up ? "#10B981" : "#EF4444" }]}>
                  {s.trend} from last month
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {section === "dashboard" && (
          <View style={{ padding: 14, gap: 14 }}>
            {/* OVERVIEW CHART */}
            <View style={[styles.card]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Overview <Text style={styles.cardTitleSub}>(This Month)</Text></Text>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>This Month</Text>
                  <Feather name="chevron-down" size={12} color="#64748B" />
                </View>
              </View>
              <LineChart width={width - 28} />
            </View>

            {/* LIVE MAP */}
            <View style={[styles.card]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Live Activity Map</Text>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>All Activities</Text>
                  <Feather name="chevron-down" size={12} color="#64748B" />
                </View>
              </View>
              <AdminMapView />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {[
                  { color: "#3B82F6", label: "Active Requests" },
                  { color: "#10B981", label: "Donations" },
                  { color: "#8B5CF6", label: "Volunteers" },
                  { color: "#F59E0B", label: "Community Groups" },
                ].map((l) => (
                  <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
                    <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* RECENT REQUESTS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Requests</Text>
                <Pressable onPress={() => setSection("requests")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              {requests.slice(0, 4).map((req) => (
                <View key={req.id} style={styles.requestRow}>
                  <View style={styles.requestAvatar}>
                    <Text style={styles.requestAvatarText}>{req.requesterName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName} numberOfLines={1}>{req.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Feather name="map-pin" size={9} color="#94A3B8" />
                      <Text style={styles.requestLoc} numberOfLines={1}>
                        {req.location?.address ?? "Your City"}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(req.status) + "20" }]}>
                    <Text style={[styles.statusPillText, { color: getStatusColor(req.status) }]}>
                      {getStatusLabel(req.status)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* RECENT DONATIONS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Donations</Text>
                <Pressable onPress={() => setSection("donations")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              {donations.slice(0, 4).map((d) => (
                <View key={d.id} style={styles.donationRow}>
                  <View style={[styles.donationIcon, { backgroundColor: "#FFFBEB" }]}>
                    <Feather name="gift" size={16} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.donationTitle} numberOfLines={1}>{d.quantity}× {d.itemType}</Text>
                    <Text style={styles.donationBy}>By {d.donorName}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.donationAmt}>{d.quantity} items</Text>
                    <Text style={styles.donationTime}>{timeAgo(d.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* PENDING REPORTS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Pending Reports</Text>
                <Pressable onPress={() => setSection("reports")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              {PENDING_REPORTS.map((r) => (
                <View key={r.id} style={styles.reportRow}>
                  <View style={[styles.reportFlag, { backgroundColor: r.color + "15" }]}>
                    <Feather name="flag" size={14} color={r.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportTitle}>{r.title}</Text>
                    <Text style={styles.reportDesc}>{r.desc}</Text>
                  </View>
                  <Text style={styles.reportTime}>{r.time}</Text>
                </View>
              ))}
            </View>

            {/* SYSTEM SUMMARY */}
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>System Summary</Text>
              {SYSTEM_SUMMARY.map((s, i) => (
                <View key={s.label} style={[styles.summaryRow, i < SYSTEM_SUMMARY.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }]}>
                  <Text style={styles.summaryLabel}>{s.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={styles.summaryVal}>{s.val}</Text>
                    <Feather name="chevron-right" size={14} color="#CBD5E1" />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {section === "users" && (() => {
          const filtered = allUsers.filter(
            (u) =>
              u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
              u.email.toLowerCase().includes(userSearch.toLowerCase())
          );

          async function handleToggleAdmin(u: typeof allUsers[0]) {
            if (u.id === user?.id) {
              Alert.alert("Not Allowed", "You cannot change your own admin role.");
              return;
            }
            Alert.alert(
              u.isAdmin ? "Remove Admin" : "Make Admin",
              `${u.isAdmin ? "Remove admin privileges from" : "Grant admin privileges to"} ${u.name}?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: u.isAdmin ? "Remove" : "Promote",
                  style: u.isAdmin ? "destructive" : "default",
                  onPress: async () => {
                    try { await toggleAdminRole(u.id); }
                    catch { Alert.alert("Error", "Failed to update role."); }
                  },
                },
              ]
            );
          }

          async function handleSuspend(u: typeof allUsers[0]) {
            if (u.id === user?.id) {
              Alert.alert("Not Allowed", "You cannot suspend your own account.");
              return;
            }
            const action = u.suspended ? "Unsuspend" : "Suspend";
            Alert.alert(
              `${action} User`,
              `${action} ${u.name}'s access to HelpChain?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: action,
                  style: u.suspended ? "default" : "destructive",
                  onPress: async () => {
                    try { await suspendUser(u.id, !u.suspended); }
                    catch { Alert.alert("Error", "Failed to update user."); }
                  },
                },
              ]
            );
          }

          async function handleDelete(u: typeof allUsers[0]) {
            if (u.id === user?.id) {
              Alert.alert("Not Allowed", "You cannot delete your own account here.");
              return;
            }
            Alert.alert(
              "Delete User",
              `Permanently remove ${u.name} from HelpChain? This cannot be undone.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try { await deleteUserFromFirestore(u.id); }
                    catch { Alert.alert("Error", "Failed to delete user."); }
                  },
                },
              ]
            );
          }

          return (
            <View style={{ padding: 14, gap: 10 }}>
              {/* Search bar */}
              <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }]}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search users by name or email…"
                  placeholderTextColor="#94A3B8"
                  style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#1E293B" }}
                />
                {userSearch.length > 0 && (
                  <Pressable onPress={() => setUserSearch("")}>
                    <Feather name="x" size={14} color="#94A3B8" />
                  </Pressable>
                )}
              </View>

              <Text style={styles.sectionHeader}>
                {filtered.length} / {allUsers.length} USERS
              </Text>

              {filtered.map((u) => {
                const isSelf = u.id === user?.id;
                const donatedItems = donations.filter((d) => d.donorId === u.id).reduce((s, d) => s + d.quantity, 0);
                return (
                  <View
                    key={u.id}
                    style={[
                      styles.card,
                      u.suspended && { borderWidth: 1.5, borderColor: "#FEF2F2" },
                    ]}
                  >
                    {/* Top row: avatar + info + badges */}
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                      {/* Avatar */}
                      <View style={[styles.requestAvatar, { width: 48, height: 48, borderRadius: 24, overflow: "hidden" }]}>
                        {u.photoURL ? (
                          <Image source={{ uri: u.photoURL }} style={{ width: 48, height: 48 }} resizeMode="cover" />
                        ) : (
                          <Text style={[styles.requestAvatarText, { fontSize: 18 }]}>{u.name.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>

                      {/* Name + email + badges */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <Text style={styles.requestName}>{u.name}</Text>
                          {isSelf && (
                            <View style={{ backgroundColor: "#F0FDF4", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 9, color: "#16A34A", fontFamily: "Inter_600SemiBold" }}>You</Text>
                            </View>
                          )}
                          {u.isAdmin && (
                            <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 9, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Admin</Text>
                            </View>
                          )}
                          {u.suspended && (
                            <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 9, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>Suspended</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.requestLoc}>{u.email}</Text>
                        {u.phone ? <Text style={styles.requestLoc}>{u.phone}</Text> : null}
                      </View>
                    </View>

                    {/* Stats row */}
                    <View style={{ flexDirection: "row", gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
                      <View style={{ alignItems: "center", gap: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: BLUE_LIGHT }}>{u.requestsCreated}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>Requests</Text>
                      </View>
                      <View style={{ alignItems: "center", gap: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#14B8A6" }}>{u.helpOffered}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>Helped</Text>
                      </View>
                      <View style={{ alignItems: "center", gap: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>{donatedItems}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>Donated</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#CBD5E1", alignSelf: "flex-end" }}>
                        Since {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </Text>
                    </View>

                    {/* Action buttons — hidden for self */}
                    {!isSelf && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        {/* Promote / Demote */}
                        <Pressable
                          onPress={() => handleToggleAdmin(u)}
                          style={({ pressed }) => [
                            styles.adminActionBtn,
                            { backgroundColor: u.isAdmin ? "#FEF3C7" : "#DBEAFE", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Feather name="shield" size={12} color={u.isAdmin ? "#D97706" : BLUE_LIGHT} />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: u.isAdmin ? "#D97706" : BLUE_LIGHT }}>
                            {u.isAdmin ? "Remove Admin" : "Make Admin"}
                          </Text>
                        </Pressable>

                        {/* Suspend / Unsuspend */}
                        <Pressable
                          onPress={() => handleSuspend(u)}
                          style={({ pressed }) => [
                            styles.adminActionBtn,
                            { backgroundColor: u.suspended ? "#F0FDF4" : "#FEF2F2", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Feather name={u.suspended ? "user-check" : "user-x"} size={12} color={u.suspended ? "#16A34A" : "#EF4444"} />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: u.suspended ? "#16A34A" : "#EF4444" }}>
                            {u.suspended ? "Unsuspend" : "Suspend"}
                          </Text>
                        </Pressable>

                        {/* Delete */}
                        <Pressable
                          onPress={() => handleDelete(u)}
                          style={({ pressed }) => [
                            styles.adminActionBtn,
                            { backgroundColor: "#F8FAFC", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Feather name="trash-2" size={12} color="#94A3B8" />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8" }}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              {filtered.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                  <Feather name="users" size={32} color="#CBD5E1" />
                  <Text style={{ color: "#94A3B8", fontFamily: "Inter_400Regular", fontSize: 14 }}>No users match your search</Text>
                </View>
              )}
            </View>
          );
        })()}

        {section === "requests" && (
          <View style={{ padding: 14, gap: 10 }}>
            <Text style={styles.sectionHeader}>{requests.length} TOTAL REQUESTS</Text>
            {requests.map((req) => (
              <Pressable key={req.id} onPress={() => router.push(`/request/${req.id}` as any)} style={styles.card}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View style={[styles.requestAvatar, { backgroundColor: req.isEmergency ? "#FEE2E2" : "#DBEAFE" }]}>
                    <Text style={[styles.requestAvatarText, { color: req.isEmergency ? "#EF4444" : BLUE_LIGHT }]}>{req.requesterName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName} numberOfLines={1}>{req.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Feather name="map-pin" size={9} color="#94A3B8" />
                      <Text style={styles.requestLoc}>{req.location?.address ?? "Your City"}</Text>
                    </View>
                    <Text style={[styles.requestLoc, { marginTop: 2 }]}>by {req.requesterName} · {timeAgo(req.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.statusPill, { backgroundColor: getStatusColor(req.status) + "20" }]}>
                      <Text style={[styles.statusPillText, { color: getStatusColor(req.status) }]}>
                        {getStatusLabel(req.status)}
                      </Text>
                    </View>
                    {req.isEmergency && (
                      <View style={[styles.statusPill, { backgroundColor: "#FEE2E2" }]}>
                        <Text style={[styles.statusPillText, { color: "#EF4444" }]}>Emergency</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {section === "donations" && (
          <View style={{ padding: 14, gap: 10 }}>
            <LinearGradient colors={["#14B8A6", "#0D9488"]} style={[styles.donationBanner]}>
              <Feather name="gift" size={28} color="#fff" />
              <View>
                <Text style={{ color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" }}>{totalItems}</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  Total items donated · {donations.length} contributions
                </Text>
              </View>
            </LinearGradient>
            <Text style={styles.sectionHeader}>{donations.length} DONATIONS</Text>
            {donations.map((d) => (
              <View key={d.id} style={[styles.card, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
                <View style={[styles.donationIcon, { width: 52, height: 52, borderRadius: 14, backgroundColor: "#F0FDFA" }]}>
                  <Feather name={(d.itemIcon ?? "gift") as any} size={22} color="#14B8A6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.donationTitle}>{d.donorName}</Text>
                  <Text style={styles.donationBy}>{d.description ?? "No description"}</Text>
                  <Text style={styles.donationTime}>{timeAgo(d.createdAt)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={[styles.donationAmt, { fontSize: 16, color: "#14B8A6" }]}>{d.quantity}×</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0D9488" }}>{d.itemType}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {section === "chat" && (
          <View style={{ padding: 14, gap: 10 }}>
            <Text style={styles.sectionHeader}>{messages.length} COMMUNITY MESSAGES</Text>
            {[...messages].reverse().map((m) => (
              <View key={m.id} style={[styles.card, { flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
                <View style={[styles.requestAvatar, { width: 38, height: 38, borderRadius: 19 }]}>
                  <Text style={[styles.requestAvatarText, { fontSize: 14 }]}>{m.userName.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.requestName}>{m.userName}</Text>
                    <Text style={[styles.donationTime, { marginLeft: "auto" as any }]}>{timeAgo(m.createdAt)}</Text>
                  </View>
                  <Text style={[styles.requestLoc, { marginTop: 2 }]} numberOfLines={3}>{m.text}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {section === "reports" && (
          <View style={{ padding: 14, gap: 10 }}>
            <Text style={styles.sectionHeader}>{PENDING_REPORTS.length} PENDING REPORTS</Text>
            {PENDING_REPORTS.map((r) => (
              <View key={r.id} style={[styles.card, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
                <View style={[styles.reportFlag, { width: 44, height: 44, borderRadius: 12, backgroundColor: r.color + "15" }]}>
                  <Feather name="flag" size={20} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>{r.title}</Text>
                  <Text style={styles.reportDesc}>{r.desc}</Text>
                </View>
                <Text style={styles.reportTime}>{r.time}</Text>
              </View>
            ))}
          </View>
        )}

        {section === "location" && (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Live Location Map</Text>
              <AdminMapView />
            </View>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Recent Location Activity</Text>
              {requests.filter((r) => r.location).map((r) => (
                <View key={r.id} style={styles.requestRow}>
                  <Feather name="map-pin" size={16} color={BLUE_LIGHT} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.requestLoc}>{r.location?.address}</Text>
                  </View>
                  <Text style={styles.reportTime}>{timeAgo(r.createdAt)}</Text>
                </View>
              ))}
              {requests.filter((r) => r.location).length === 0 && (
                <Text style={{ color: "#94A3B8", textAlign: "center", paddingVertical: 20, fontFamily: "Inter_400Regular" }}>
                  No location data yet
                </Text>
              )}
            </View>
          </View>
        )}

        {section === "analytics" && (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Platform Analytics</Text>
              <LineChart width={width - 28} />
            </View>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Key Metrics</Text>
              {[
                { label: "Avg. Response Time", val: "~12 min", icon: "clock", color: BLUE_LIGHT },
                { label: "Help Success Rate", val: "94%", icon: "check-circle", color: "#10B981" },
                { label: "Emergency Resolve Rate", val: "98%", icon: "alert-circle", color: "#EF4444" },
                { label: "User Satisfaction", val: "4.8/5", icon: "star", color: "#F59E0B" },
                { label: "Repeat Helpers", val: "67%", icon: "repeat", color: "#8B5CF6" },
              ].map((m) => (
                <View key={m.label} style={styles.summaryRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name={m.icon as any} size={14} color={m.color} />
                    <Text style={styles.summaryLabel}>{m.label}</Text>
                  </View>
                  <Text style={[styles.summaryVal, { color: m.color }]}>{m.val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {section === "settings" && (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>App Settings</Text>
              {[
                { label: "Notifications", icon: "bell" },
                { label: "Privacy & Security", icon: "shield" },
                { label: "Language", icon: "globe" },
                { label: "Theme", icon: "sun" },
                { label: "Emergency Contacts", icon: "phone" },
                { label: "Terms & Conditions", icon: "file-text" },
              ].map((s) => (
                <View key={s.label} style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Feather name={s.icon as any} size={16} color="#64748B" />
                    <Text style={styles.summaryLabel}>{s.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#CBD5E1" />
                </View>
              ))}
            </View>
            <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
              <View style={[styles.requestAvatar, { width: 50, height: 50, borderRadius: 25, backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.requestAvatarText, { color: BLUE_LIGHT, fontSize: 18 }]}>{user?.name?.charAt(0) ?? "A"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestName}>{user?.name ?? "Admin"}</Text>
                <Text style={styles.requestLoc}>{user?.email}</Text>
                <View style={{ backgroundColor: "#DBEAFE", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Super Admin</Text>
                </View>
              </View>
              <Pressable
                onPress={async () => { await logout(); router.replace("/(auth)/portal" as any); }}
                style={{ padding: 8 }}
              >
                <Feather name="log-out" size={20} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── SIDEBAR DRAWER ── */}
      {drawerOpen && (
        <>
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)", opacity: overlayOpacity, zIndex: 10 }]} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[styles.drawer, { transform: [{ translateX: drawerX }], paddingTop: topPad, zIndex: 20 }]}
          >
            <LinearGradient colors={[BLUE_DARK, BLUE_MID, BLUE_LIGHT]} style={StyleSheet.absoluteFillObject} />

            {/* Logo */}
            <View style={styles.drawerLogo}>
              <Image source={logo} style={styles.drawerLogoImg} resizeMode="contain" />
              <View>
                <Text style={styles.drawerLogoTitle}>HelpChain</Text>
                <Text style={styles.drawerLogoSub}>Admin Panel</Text>
              </View>
            </View>

            <View style={styles.drawerDivider} />

            {/* Nav items */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {NAV_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => navTo(item.key)}
                  style={[styles.drawerItem, section === item.key && styles.drawerItemActive]}
                >
                  <Feather
                    name={item.icon as any}
                    size={16}
                    color={section === item.key ? BLUE_LIGHT : "rgba(255,255,255,0.75)"}
                  />
                  <Text style={[styles.drawerItemText, { color: section === item.key ? BLUE_LIGHT : "rgba(255,255,255,0.85)" }]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.drawerDivider} />

            {/* User + Logout */}
            <View style={styles.drawerUser}>
              <View style={[styles.requestAvatar, { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Text style={[styles.requestAvatarText, { color: "#fff" }]}>{user?.name?.charAt(0) ?? "A"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerItemText, { color: "#fff" }]}>{user?.name ?? "Admin"}</Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontFamily: "Inter_400Regular" }}>Super Admin ●</Text>
              </View>
            </View>
            <Pressable
              onPress={async () => { closeDrawer(); await logout(); router.replace("/(auth)/portal" as any); }}
              style={styles.drawerLogout}
            >
              <Feather name="log-out" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.drawerLogoutText}>Logout</Text>
            </Pressable>
            <View style={{ height: Platform.OS === "web" ? 20 : insets.bottom + 12 }} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 5,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E293B" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { fontSize: 8, color: "#fff", fontFamily: "Inter_700Bold" },
  dateBox: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F1F5F9", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  dateText: { fontSize: 9, color: "#64748B", fontFamily: "Inter_500Medium" },

  statCard: {
    width: 130,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E293B", marginTop: 2 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
  statTrend: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  statTrendText: { fontSize: 9, fontFamily: "Inter_400Regular" },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E293B" },
  cardTitleSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  cardBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardBadgeText: { fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" },
  viewAll: { fontSize: 12, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" },

  requestRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  requestAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  requestAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: BLUE_LIGHT },
  requestName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  requestLoc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  donationRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  donationIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  donationTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  donationBy: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },
  donationAmt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#F59E0B" },
  donationTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#14B8A6", marginTop: 1 },
  donationBanner: { borderRadius: 14, padding: 20, flexDirection: "row", alignItems: "center", gap: 16 },

  reportRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  reportFlag: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  reportDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },
  reportTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#475569" },
  summaryVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1E293B" },

  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", letterSpacing: 0.8, marginBottom: 2 },

  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    overflow: "hidden",
  },
  drawerLogo: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  drawerLogoImg: { width: 40, height: 40, borderRadius: 12 },
  drawerLogoTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  drawerLogoSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  drawerDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 16, marginVertical: 6 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 10,
  },
  drawerItemActive: { backgroundColor: "#fff" },
  drawerItemText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  drawerUser: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  drawerLogout: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  drawerLogoutText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },

  adminActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
});
