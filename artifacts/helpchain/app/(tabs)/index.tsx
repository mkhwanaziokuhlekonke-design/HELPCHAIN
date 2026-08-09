import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path, Line as SvgLine, Text as SvgText, G } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { LiveLocationMap } from "@/components/LiveLocationMap";
import { useAuth } from "@/context/AuthContext";
import { useHelp } from "@/context/HelpContext";
import { useChat } from "@/context/ChatContext";
import { useDonations } from "@/context/DonationContext";
import { usePresence } from "@/context/PresenceContext";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo.jpeg");

/* ─── shared helpers ─── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function statusColor(status: string) {
  if (status === "open") return "#10B981";
  if (status === "accepted") return "#F59E0B";
  if (status === "completed") return "#14B8A6";
  return "#9CA3AF";
}
function statusLabel(status: string) {
  if (status === "open") return "New";
  if (status === "accepted") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const CHART_POINTS = {
  requests: [200, 350, 480, 600, 780, 900, 1000],
  donations: [80, 180, 300, 410, 540, 660, 760],
  users: [50, 140, 240, 350, 460, 540, 600],
};

function buildPath(data: number[], w: number, h: number, maxY: number) {
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / maxY) * (h - 16),
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${cx} ${pts[i - 1].y}, ${cx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function MiniChart({ width }: { width: number }) {
  const W = width - 32;
  const H = 140;
  const maxY = 1200;
  return (
    <View style={{ paddingHorizontal: 4 }}>
      <Svg width={W} height={H + 24}>
        {[0, 400, 800, 1200].map((val) => {
          const y = H - (val / maxY) * (H - 16) + 2;
          return (
            <G key={val}>
              <SvgLine x1={0} y1={y} x2={W} y2={y} stroke="#E2E8F0" strokeWidth={1} />
              <SvgText x={-2} y={y + 4} fontSize={8} fill="#94A3B8" textAnchor="end">
                {val === 0 ? "0" : val >= 1000 ? `${val / 1000}k` : val}
              </SvgText>
            </G>
          );
        })}
        <Path d={buildPath(CHART_POINTS.requests, W, H, maxY)} fill="none" stroke="#3B82F6" strokeWidth={2} />
        <Path d={buildPath(CHART_POINTS.donations, W, H, maxY)} fill="none" stroke="#14B8A6" strokeWidth={2} />
        <Path d={buildPath(CHART_POINTS.users, W, H, maxY)} fill="none" stroke="#A78BFA" strokeWidth={2} />
        {CHART_POINTS.requests.map((v, i) => (
          <Circle key={`r${i}`} cx={(i / 6) * W} cy={H - (v / maxY) * (H - 16)} r={3} fill="#3B82F6" />
        ))}
        {CHART_POINTS.donations.map((v, i) => (
          <Circle key={`d${i}`} cx={(i / 6) * W} cy={H - (v / maxY) * (H - 16)} r={3} fill="#14B8A6" />
        ))}
        {CHART_POINTS.users.map((v, i) => (
          <Circle key={`u${i}`} cx={(i / 6) * W} cy={H - (v / maxY) * (H - 16)} r={3} fill="#A78BFA" />
        ))}
        {["1", "11", "21", "31"].map((lbl, i) => (
          <SvgText key={lbl} x={(i / 3) * W} y={H + 16} fontSize={8} fill="#94A3B8" textAnchor="middle">{lbl}</SvgText>
        ))}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, paddingLeft: 4, marginTop: 4 }}>
        {[{ c: "#3B82F6", l: "Requests" }, { c: "#14B8A6", l: "Donations" }, { c: "#A78BFA", l: "Users" }].map((s) => (
          <View key={s.l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 18, height: 3, backgroundColor: s.c, borderRadius: 2 }} />
            <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{s.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

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

/* ─── admin dashboard (inline) ─── */
function AdminDashboard() {
  const { allUsers } = useAuth();
  const { requests } = useHelp();
  const { donations, totalItems } = useDonations();
  const { messages } = useChat();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const openReqs = requests.filter((r) => r.status === "open").length;
  const completedReqs = requests.filter((r) => r.status === "completed").length;

  const STATS = [
    { label: "Total Users", val: String(allUsers.length), icon: "user", bg: "#3B82F6", trend: "+12.5%" },
    { label: "Active Requests", val: String(openReqs), icon: "activity", bg: "#10B981", trend: "+8.3%" },
    { label: "Completed", val: String(completedReqs), icon: "check-circle", bg: "#8B5CF6", trend: "+15.7%" },
    { label: "Donations Made", val: String(donations.length), icon: "gift", bg: "#F59E0B", trend: "+10.2%" },
    { label: "Community Groups", val: "86", icon: "users", bg: "#EC4899", trend: "+6.4%" },
    { label: "Pending Reports", val: String(PENDING_REPORTS.length), icon: "alert-circle", bg: "#EF4444", trend: "↓3.2%" },
  ];

  return (
    <View style={{ gap: 14 }}>
      {/* Stat cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {STATS.map((s) => (
          <View key={s.label} style={adm.statCard}>
            <View style={[adm.statCircle, { backgroundColor: s.bg }]}>
              <Feather name={s.icon as any} size={18} color="#fff" />
            </View>
            <Text style={adm.statVal}>{s.val}</Text>
            <Text style={adm.statLabel}>{s.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
              <Feather name="trending-up" size={9} color="#10B981" />
              <Text style={{ fontSize: 9, color: "#10B981", fontFamily: "Inter_400Regular" }}>{s.trend} from last month</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Overview chart */}
      <View style={adm.card}>
        <View style={adm.cardHead}>
          <Text style={adm.cardTitle}>Overview <Text style={{ color: "#94A3B8", fontFamily: "Inter_400Regular", fontSize: 12 }}>(This Month)</Text></Text>
          <View style={adm.pill}><Text style={adm.pillText}>This Month</Text><Feather name="chevron-down" size={11} color="#64748B" /></View>
        </View>
        <MiniChart width={width - 32} />
      </View>

      {/* Live map */}
      <View style={adm.card}>
        <View style={adm.cardHead}>
          <Text style={adm.cardTitle}>Live Activity Map</Text>
          <View style={adm.pill}><Text style={adm.pillText}>All Activities</Text><Feather name="chevron-down" size={11} color="#64748B" /></View>
        </View>
        {Platform.OS === "web" ? (
          <iframe
            src="https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.69,-73.97,40.73&layer=mapnik"
            style={{ width: "100%", height: 170, border: "none", borderRadius: 8 } as any}
            title="Live Activity Map"
          />
        ) : (
          <View style={{ height: 170, backgroundColor: "#DBEAFE", borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Feather name="map" size={32} color="#3B82F6" />
            <Text style={{ color: "#1D4ED8", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Live Activity Map</Text>
          </View>
        )}
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

      {/* Recent Requests */}
      <View style={adm.card}>
        <View style={adm.cardHead}>
          <Text style={adm.cardTitle}>Recent Requests</Text>
          <Pressable onPress={() => router.push("/admin" as any)}>
            <Text style={adm.viewAll}>View All</Text>
          </Pressable>
        </View>
        {requests.slice(0, 4).map((req) => (
          <View key={req.id} style={adm.row}>
            <View style={[adm.avatar, { backgroundColor: req.isEmergency ? "#FEE2E2" : "#DBEAFE" }]}>
              <Text style={[adm.avatarText, { color: req.isEmergency ? "#EF4444" : "#2563EB" }]}>{req.requesterName.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={adm.rowTitle} numberOfLines={1}>{req.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                <Feather name="map-pin" size={9} color="#94A3B8" />
                <Text style={adm.rowSub}>{req.location?.address ?? "Your City"}</Text>
              </View>
            </View>
            <View style={[adm.badge, { backgroundColor: statusColor(req.status) + "20" }]}>
              <Text style={[adm.badgeText, { color: statusColor(req.status) }]}>{statusLabel(req.status)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent Donations */}
      <View style={adm.card}>
        <View style={adm.cardHead}>
          <Text style={adm.cardTitle}>Recent Donations</Text>
          <Pressable onPress={() => router.push("/admin" as any)}>
            <Text style={adm.viewAll}>View All</Text>
          </Pressable>
        </View>
        {donations.slice(0, 4).map((d) => (
          <View key={d.id} style={adm.row}>
            <View style={[adm.avatar, { backgroundColor: "#FFFBEB" }]}>
              <Feather name="gift" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={adm.rowTitle}>{d.quantity}× {d.itemType}</Text>
              <Text style={adm.rowSub}>By {d.donorName}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#14B8A6" }}>{d.quantity}× {d.itemType}</Text>
              <Text style={{ fontSize: 10, color: "#14B8A6", fontFamily: "Inter_400Regular" }}>{timeAgo(d.createdAt)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Pending Reports */}
      <View style={adm.card}>
        <View style={adm.cardHead}>
          <Text style={adm.cardTitle}>Pending Reports</Text>
          <Pressable onPress={() => router.push("/admin" as any)}>
            <Text style={adm.viewAll}>View All</Text>
          </Pressable>
        </View>
        {PENDING_REPORTS.map((r) => (
          <View key={r.id} style={adm.row}>
            <View style={[adm.avatar, { backgroundColor: r.color + "15" }]}>
              <Feather name="flag" size={14} color={r.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={adm.rowTitle}>{r.title}</Text>
              <Text style={adm.rowSub}>{r.desc}</Text>
            </View>
            <Text style={{ fontSize: 10, color: "#94A3B8", fontFamily: "Inter_400Regular" }}>{r.time}</Text>
          </View>
        ))}
      </View>

      {/* System Summary */}
      <View style={adm.card}>
        <Text style={[adm.cardTitle, { marginBottom: 10 }]}>System Summary</Text>
        {SYSTEM_SUMMARY.map((s, i) => (
          <View key={s.label} style={[adm.summaryRow, i < SYSTEM_SUMMARY.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }]}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#475569" }}>{s.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#1E293B" }}>{s.val}</Text>
              <Feather name="chevron-right" size={13} color="#CBD5E1" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── Community Feed (live from Firestore) ─── */
function CommunityFeed() {
  const colors = useColors();
  const router = useRouter();
  const { requests, loading: reqLoading } = useHelp();
  const { donations } = useDonations();

  type FeedItem =
    | { kind: "request"; id: string; title: string; name: string; sub: string; ts: string; emergency: boolean }
    | { kind: "donation"; id: string; title: string; name: string; sub: string; ts: string };

  const feed: FeedItem[] = [
    ...requests.slice(0, 8).map((r) => ({
      kind: "request" as const,
      id: r.id,
      title: r.title,
      name: r.requesterName,
      sub: r.category.charAt(0).toUpperCase() + r.category.slice(1),
      ts: r.createdAt,
      emergency: r.isEmergency,
    })),
    ...donations.slice(0, 4).map((d) => ({
      kind: "donation" as const,
      id: d.id,
      title: `${d.quantity}× ${d.itemType}`,
      name: d.donorName,
      sub: d.description || "Donated to community",
      ts: d.createdAt,
    })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 10);

  return (
    <View style={[feed_s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={feed_s.header}>
        <View style={feed_s.headerLeft}>
          <View style={[feed_s.dot, { backgroundColor: "#10B981" }]} />
          <Text style={[feed_s.title, { color: colors.foreground }]}>Community Activity</Text>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/requests" as any)}>
          <Text style={[feed_s.viewAll, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>

      {reqLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : feed.length === 0 ? (
        <View style={feed_s.empty}>
          <Feather name="inbox" size={28} color={colors.muted} />
          <Text style={[feed_s.emptyText, { color: colors.mutedForeground }]}>
            No activity yet — be the first to post!
          </Text>
        </View>
      ) : (
        feed.map((item) => {
          const isEmergency = item.kind === "request" && item.emergency;
          const iconName =
            item.kind === "donation"
              ? "gift"
              : isEmergency
              ? "alert-triangle"
              : "life-buoy";
          const iconBg =
            item.kind === "donation"
              ? "#F3E8FF"
              : isEmergency
              ? "#FEE2E2"
              : "#DBEAFE";
          const iconColor =
            item.kind === "donation"
              ? "#7C3AED"
              : isEmergency
              ? "#DC2626"
              : "#2563EB";

          return (
            <Pressable
              key={`${item.kind}-${item.id}`}
              onPress={() =>
                item.kind === "request"
                  ? router.push(`/request/${item.id}` as any)
                  : undefined
              }
              style={({ pressed }) => [
                feed_s.row,
                { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[feed_s.iconWrap, { backgroundColor: iconBg }]}>
                <Feather name={iconName as any} size={16} color={iconColor} />
              </View>
              <View style={feed_s.textCol}>
                <View style={feed_s.titleRow}>
                  {isEmergency && (
                    <View style={feed_s.emergencyPill}>
                      <Text style={feed_s.emergencyPillText}>EMERGENCY</Text>
                    </View>
                  )}
                  <Text style={[feed_s.itemTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={[feed_s.itemSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.kind === "donation" ? "🎁 " : ""}
                  {item.name} · {item.sub}
                </Text>
              </View>
              <Text style={[feed_s.time, { color: colors.mutedForeground }]}>{timeAgo(item.ts)}</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const feed_s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  viewAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  itemSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emergencyPill: {
    backgroundColor: "#DC2626",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  emergencyPillText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

/* ─── main screen ─── */
export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { addDonation } = useDonations();
  const { activeCount } = usePresence();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [donateVisible, setDonateVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: string; icon: string } | null>(null);
  const [selectedQty, setSelectedQty] = useState<number | null>(null);
  const [donateNote, setDonateNote] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  function tap(action: () => void) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action();
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const isAdmin = user?.isAdmin ?? false;

  const ACTION_BUTTONS = [
    {
      key: "request",
      icon: "life-buoy",
      title: "Request Help",
      shortTitle: "Request",
      sub: "Post a help request",
      colors: ["#2563EB", "#1D4ED8"] as [string, string],
      onPress: () => tap(() => router.push("/request/new" as any)),
    },
    {
      key: "emergency",
      icon: "alert-triangle",
      title: "Emergency",
      shortTitle: "Emergency",
      sub: "Get urgent help now",
      colors: ["#DC2626", "#B91C1C"] as [string, string],
      onPress: () => tap(() => router.push("/request/new?emergency=1" as any)),
    },
    {
      key: "chat",
      icon: "message-circle",
      title: "Community Chat",
      shortTitle: "Chat",
      sub: "Talk with your community",
      colors: ["#14B8A6", "#0D9488"] as [string, string],
      onPress: () => tap(() => router.push("/(tabs)/chat" as any)),
    },
    {
      key: "donate",
      icon: "gift",
      title: "Donate",
      shortTitle: "Donate",
      sub: "Support HelpChain",
      colors: ["#0EA5E9", "#0284C7"] as [string, string],
      onPress: () => tap(() => setDonateVisible(true)),
    },
  ];

  // ── Admin view ────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
        <LinearGradient colors={["#1F2937", "#1E3A8A"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
          <View style={styles.headerRow}>
            <View style={styles.greetingCol}>
              <Text style={styles.greetingSmall}>{greeting()},</Text>
              <Text style={styles.greetingName}>{user?.name?.split(" ")[0] ?? "Friend"}</Text>
              <Text style={styles.slogan}>Help together. Grow together.</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => tap(() => router.push("/admin" as any))}
                style={[styles.adminBtn, { backgroundColor: "#14B8A6" }]}
              >
                <Feather name="settings" size={14} color="#fff" />
                <Text style={styles.adminBtnText}>Full View</Text>
              </Pressable>
              <UserAvatar name={user?.name ?? "U"} size={44} isAdmin />
            </View>
          </View>
        </LinearGradient>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          <AdminDashboard />
        </ScrollView>
      </View>
    );
  }

  // ── User view: full-screen map ─────────────────────────────────────────────
  // Floating buttons sit just above the tab bar
  const TAB_BAR_H = Platform.OS === "web" ? 84 : 49;
  const btnBottom = Platform.OS === "web" ? TAB_BAR_H + 12 : TAB_BAR_H + insets.bottom + 12;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Full-screen map ── */}
      <LiveLocationMap fullScreen />

      {/* ── Top greeting card ── */}
      <View style={[styles.topOverlay, { top: topPad }]} pointerEvents="box-none">
        <View style={styles.greetingCard}>
          <View style={styles.greetingCol}>
            <Text style={styles.greetingSmall}>{greeting()},</Text>
            <Text style={styles.greetingName}>{user?.name?.split(" ")[0] ?? "Friend"}</Text>
            <View style={styles.activeRow}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>
                {activeCount > 0
                  ? `${activeCount} member${activeCount === 1 ? "" : "s"} active`
                  : "Community online"}
              </Text>
            </View>
          </View>
          <UserAvatar name={user?.name ?? "U"} size={44} />
        </View>
      </View>

      {/* ── Floating action buttons at bottom ── */}
      <View style={[styles.floatingBar, { bottom: btnBottom }]}>
        {ACTION_BUTTONS.map((btn) => (
          <Pressable
            key={btn.key}
            onPress={btn.onPress}
            style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={btn.colors} style={styles.floatBtnInner}>
              <View style={styles.floatIconRing}>
                <Feather name={btn.icon as any} size={22} color="#fff" />
              </View>
              <Text style={styles.floatLabel}>{btn.shortTitle}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      {/* Donate Modal */}
      <Modal visible={donateVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.donateModal, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <LinearGradient colors={["#14B8A6", "#0D9488"]} style={styles.modalHeader}>
                <Image source={logo} style={styles.modalLogo} resizeMode="contain" />
                <Text style={styles.modalTitle}>Donate to Community</Text>
                <Text style={[styles.modalSub, { color: "rgba(255,255,255,0.8)", paddingHorizontal: 0 }]}>
                  Give food, clothes, books or other essentials
                </Text>
              </LinearGradient>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingBottom: 12 }}>
                {/* Category picker */}
                <Text style={[styles.donateLabel, { color: colors.foreground }]}>What would you like to donate?</Text>
                <View style={styles.itemGrid}>
                  {[
                    { type: "Food", icon: "shopping-bag" },
                    { type: "Clothes", icon: "tag" },
                    { type: "Books", icon: "book-open" },
                    { type: "Medicine", icon: "heart" },
                    { type: "Electronics", icon: "monitor" },
                    { type: "Other", icon: "package" },
                  ].map((item) => {
                    const active = selectedItem?.type === item.type;
                    return (
                      <Pressable
                        key={item.type}
                        onPress={() => setSelectedItem(item)}
                        style={[
                          styles.itemBtn,
                          {
                            borderColor: active ? "#14B8A6" : colors.border,
                            backgroundColor: active ? "#F0FDFA" : colors.card,
                          },
                        ]}
                      >
                        <View style={[styles.itemIconCircle, { backgroundColor: active ? "#14B8A6" : "#F1F5F9" }]}>
                          <Feather name={item.icon as any} size={20} color={active ? "#fff" : "#64748B"} />
                        </View>
                        <Text style={[styles.itemLabel, { color: active ? "#0D9488" : colors.foreground }]}>{item.type}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Quantity picker */}
                <Text style={[styles.donateLabel, { color: colors.foreground }]}>How many / how much?</Text>
                <View style={styles.qtyRow}>
                  {[1, 2, 5, 10].map((q) => {
                    const active = selectedQty === q;
                    return (
                      <Pressable
                        key={q}
                        onPress={() => setSelectedQty(q)}
                        style={[
                          styles.qtyBtn,
                          {
                            borderColor: active ? "#14B8A6" : colors.border,
                            backgroundColor: active ? "#F0FDFA" : colors.card,
                          },
                        ]}
                      >
                        <Text style={[styles.qtyText, { color: active ? "#0D9488" : colors.foreground }]}>{q}{q === 10 ? "+" : ""}</Text>
                        <Text style={[styles.qtyUnit, { color: colors.mutedForeground }]}>item{q !== 1 ? "s" : ""}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Note */}
                <Text style={[styles.donateLabel, { color: colors.foreground }]}>Add a note <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>(optional)</Text></Text>
                <TextInput
                  value={donateNote}
                  onChangeText={setDonateNote}
                  placeholder="e.g. Winter jackets, size M and L..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={2}
                  style={[styles.noteInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                />

                {/* Submit */}
                <Pressable
                  onPress={async () => {
                    if (!selectedItem) {
                      Alert.alert("Select an item", "Please choose what you'd like to donate.");
                      return;
                    }
                    if (!user) {
                      Alert.alert("Not signed in", "Please sign in to donate.");
                      return;
                    }
                    const qty = selectedQty ?? 1;
                    const itemSnapshot = { ...selectedItem };
                    const noteSnapshot = donateNote;
                    setDonateVisible(false);
                    setSelectedItem(null);
                    setSelectedQty(null);
                    setDonateNote("");
                    try {
                      // ── Capture donor GPS (best-effort — donation proceeds even if denied) ──
                      let donorLocation: { latitude: number; longitude: number; address?: string } | undefined;
                      try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === "granted") {
                          const pos = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                          });
                          let address: string | undefined;
                          try {
                            const geo = await Location.reverseGeocodeAsync({
                              latitude: pos.coords.latitude,
                              longitude: pos.coords.longitude,
                            });
                            if (geo[0]) {
                              const g = geo[0];
                              address = [g.name, g.street, g.city, g.region]
                                .filter(Boolean)
                                .join(", ");
                            }
                          } catch {}
                          donorLocation = {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            address,
                          };
                        }
                      } catch {}
                      await addDonation(user.id, user.name, itemSnapshot.type, itemSnapshot.icon, qty, noteSnapshot || undefined, donorLocation);
                      Alert.alert(
                        "Thank you! 🙏",
                        `Your donation of ${qty} ${itemSnapshot.type} item${qty !== 1 ? "s" : ""} has been registered. Our team will contact you for pickup.`
                      );
                    } catch {
                      Alert.alert("Donation Failed", "Could not save your donation. Please check your connection and try again.");
                    }
                  }}
                  style={[styles.donateSendBtn, { backgroundColor: "#14B8A6" }]}
                >
                  <Feather name="heart" size={18} color="#fff" />
                  <Text style={styles.donateSendText}>
                    Donate{selectedItem ? ` ${selectedQty ?? 1} ${selectedItem.type}` : ""}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => { setDonateVisible(false); setSelectedItem(null); setSelectedQty(null); setDonateNote(""); }}
                  style={styles.cancelBtn}
                >
                  <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
      </Modal>
    </View>
  );
}

/* ─── admin inline styles ─── */
const adm = StyleSheet.create({
  statCard: {
    width: 130,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E293B" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHead: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E293B" },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  pillText: { fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" },
  viewAll: { fontSize: 12, color: "#2563EB", fontFamily: "Inter_600SemiBold" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC",
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  rowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  summaryRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 12,
  },
});

/* ─── user home styles ─── */
const styles = StyleSheet.create({
  // admin reuse
  headerGrad: { paddingHorizontal: 20, paddingBottom: 22 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 14, paddingHorizontal: 20 },
  greetingCol: { gap: 2, flex: 1 },
  greetingSmall: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  greetingName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E3A8A" },
  slogan: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#2563EB", marginTop: 2 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  activeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#10B981" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 12 },
  adminBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  adminBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 16 },
  // full-screen map overlay
  topOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  greetingCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  // floating bottom action bar
  floatingBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  floatBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  floatBtnInner: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 6,
  },
  floatIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatLabel: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  // kept for donate modal
  buttonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionBtn: { borderRadius: 18, overflow: "hidden" },
  actionBtnHalf: { width: "47.5%" },
  actionBtnInner: { padding: 20, alignItems: "center", gap: 10, minHeight: 150, justifyContent: "center" },
  actionIconRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  actionTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  actionSub: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  donateModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", gap: 16, paddingBottom: 24 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginTop: 12 },
  modalHeader: { alignItems: "center", padding: 24, gap: 12 },
  modalLogo: { width: 60, height: 60, borderRadius: 16 },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  modalSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
  amountGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap", paddingHorizontal: 24 },
  amountBtn: { flex: 1, minWidth: "40%", height: 52, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  amountText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  donateSendBtn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  donateSendText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cancelBtn: { height: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  donateLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  itemBtn: {
    width: "30%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    paddingVertical: 14,
    gap: 8,
  },
  itemIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  itemLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  qtyRow: { flexDirection: "row", gap: 10 },
  qtyBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    paddingVertical: 12,
    gap: 2,
  },
  qtyText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  qtyUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minHeight: 60,
    textAlignVertical: "top",
  },
});
