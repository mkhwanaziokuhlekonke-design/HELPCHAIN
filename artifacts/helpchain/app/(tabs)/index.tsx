import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path, Line as SvgLine, Text as SvgText, G } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { HelpChainLogo } from "@/components/HelpChainLogo";
import { AdminActivityMap } from "@/components/AdminActivityMap";
import { AdminUserActivityFeed } from "@/components/AdminUserActivityFeed";
import { useAuth } from "@/context/AuthContext";
import { useAnnouncements } from "@/context/AnnouncementContext";
import { useHelp } from "@/context/HelpContext";
import { useChat } from "@/context/ChatContext";
import { useDonations } from "@/context/DonationContext";
import { usePresence } from "@/context/PresenceContext";
import { useCommunityCentres } from "@/context/CommunityCentreContext";
import { useReports } from "@/context/ReportContext";
import { useColors } from "@/hooks/useColors";

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
  return "#64748B";
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
              <SvgLine x1={0} y1={y} x2={W} y2={y} stroke="#DBEAFE" strokeWidth={1} />
              <SvgText x={-2} y={y + 4} fontSize={8} fill="#64748B" textAnchor="end">
                {val === 0 ? "0" : val >= 1000 ? `${val / 1000}k` : val}
              </SvgText>
            </G>
          );
        })}
        <Path d={buildPath(CHART_POINTS.requests, W, H, maxY)} fill="none" stroke="#2563EB" strokeWidth={2} />
        <Path d={buildPath(CHART_POINTS.donations, W, H, maxY)} fill="none" stroke="#14B8A6" strokeWidth={2} />
        <Path d={buildPath(CHART_POINTS.users, W, H, maxY)} fill="none" stroke="#7C3AED" strokeWidth={2} />
        {CHART_POINTS.requests.map((v, i) => (
          <Circle key={`r${i}`} cx={(i / 6) * W} cy={H - (v / maxY) * (H - 16)} r={3} fill="#2563EB" />
        ))}
        {CHART_POINTS.donations.map((v, i) => (
          <Circle key={`d${i}`} cx={(i / 6) * W} cy={H - (v / maxY) * (H - 16)} r={3} fill="#14B8A6" />
        ))}
        {CHART_POINTS.users.map((v, i) => (
          <Circle key={`u${i}`} cx={(i / 6) * W} cy={H - (v / maxY) * (H - 16)} r={3} fill="#7C3AED" />
        ))}
        {["1", "11", "21", "31"].map((lbl, i) => (
          <SvgText key={lbl} x={(i / 3) * W} y={H + 16} fontSize={8} fill="#64748B" textAnchor="middle">{lbl}</SvgText>
        ))}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, paddingLeft: 4, marginTop: 4 }}>
        {[{ c: "#2563EB", l: "Requests" }, { c: "#14B8A6", l: "Donations" }, { c: "#7C3AED", l: "Users" }].map((s) => (
          <View key={s.l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 18, height: 3, backgroundColor: s.c, borderRadius: 2 }} />
            <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{s.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── admin dashboard (inline) ─── */
function AdminDashboard() {
  const { allUsers, allUsersLoading, allUsersError } = useAuth();
  const { requests, loading: requestsLoading } = useHelp();
  const { donations, totalItems, loading: donationsLoading } = useDonations();
  const { announcements } = useAnnouncements();
  const { centres, loading: centresLoading } = useCommunityCentres();
  const { reports, loading: reportsLoading, resolveReport } = useReports();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const activeReqs = requests.filter((r) => r.status === "open" || r.status === "accepted").length;
  const completedReqs = requests.filter((r) => r.status === "completed").length;
  const pendingReports = reports.filter((report) => report.status === "pending");
  const systemSummary = [
    { label: "Registered Users", val: String(allUsers.length) },
    { label: "Authorised Admins", val: String(allUsers.filter((u) => u.isAdmin).length) },
    { label: "Active Requests", val: requestsLoading ? "..." : String(activeReqs) },
    { label: "Items Donated", val: donationsLoading ? "..." : String(totalItems) },
    { label: "Donation Contributions", val: String(donations.length) },
    { label: "Active Centres", val: centresLoading ? "..." : String(centres.length) },
    { label: "Official Updates", val: String(announcements.length) },
  ];

  async function handleResolveReport(reportId: string) {
    try {
      await resolveReport(reportId);
    } catch (error) {
      console.warn("[AdminDashboard] report resolution failed:", error);
    }
  }

  const STATS = [
    { label: "Total Users", val: allUsersLoading ? "..." : allUsersError ? "N/A" : String(allUsers.length), icon: "user", bg: "#2563EB" },
    { label: "Active Requests", val: requestsLoading ? "..." : String(activeReqs), icon: "activity", bg: "#10B981" },
    { label: "Completed", val: requestsLoading ? "..." : String(completedReqs), icon: "check-circle", bg: "#7C3AED" },
    { label: "Items Donated", val: donationsLoading ? "..." : String(totalItems), icon: "gift", bg: "#F59E0B" },
    { label: "Active Centres", val: centresLoading ? "..." : String(centres.length), icon: "map-pin", bg: "#7C3AED" },
    { label: "Pending Reports", val: reportsLoading ? "..." : String(pendingReports.length), icon: "alert-circle", bg: "#EF4444" },
  ];

  return (
    <View style={{ gap: 14 }}>
      {/* Stat cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {STATS.map((s) => (
          <View key={s.label} style={adm.statCard}>
            <View style={[adm.statCircle, { backgroundColor: s.bg }]}>
              <Feather name={s.icon as any} size={18} color="#FFFFFF" />
            </View>
            <Text style={adm.statVal}>{s.val}</Text>
            <Text style={adm.statLabel}>{s.label}</Text>
            <Text style={{ fontSize: 9, color: "#64748B", fontFamily: "Inter_400Regular", marginTop: 2 }}>Current total</Text>
          </View>
        ))}
      </ScrollView>

      {/* Overview chart */}
      <View style={adm.card}>
        <View style={adm.cardHead}>
          <Text style={adm.cardTitle}>Overview <Text style={{ color: "#64748B", fontFamily: "Inter_400Regular", fontSize: 12 }}>(This Month)</Text></Text>
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
        <AdminActivityMap height={170} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          {[
            { color: "#2563EB", label: "Active Requests" },
            { color: "#10B981", label: "Donations" },
            { color: "#7C3AED", label: "Volunteers" },
            { color: "#F59E0B", label: "Community Groups" },
          ].map((l) => (
            <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
              <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{l.label}</Text>
            </View>
          ))}
        </View>
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
            <View style={[adm.avatar, { backgroundColor: "#F8FAFC" }]}>
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
        {reportsLoading ? <ActivityIndicator color="#2563EB" /> : pendingReports.length ? pendingReports.slice(0, 4).map((report) => (
          <View key={report.id} style={adm.row}>
            <View style={[adm.avatar, { backgroundColor: "#F8FAFC" }]}>
              <Feather name="flag" size={14} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={adm.rowTitle}>{report.reason}</Text>
              <Text style={adm.rowSub}>{report.requestTitle} · {report.reporterName}</Text>
            </View>
            <Pressable onPress={() => handleResolveReport(report.id)} style={adm.resolveButton}>
              <Text style={adm.resolveText}>Resolve</Text>
            </Pressable>
          </View>
        )) : <Text style={adm.rowSub}>No pending reports.</Text>}
      </View>

      <AdminUserActivityFeed />

      {/* System Summary */}
      <View style={adm.card}>
        <Text style={[adm.cardTitle, { marginBottom: 10 }]}>System Summary</Text>
        {systemSummary.map((summary, i) => (
          <View key={summary.label} style={[adm.summaryRow, i < systemSummary.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }]}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" }}>{summary.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#1E3A5F" }}>{summary.val}</Text>
              <Feather name="chevron-right" size={13} color="#DBEAFE" />
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
  const { announcements } = useAnnouncements();

  type FeedItem =
    | { kind: "request"; id: string; title: string; name: string; sub: string; ts: string; emergency: boolean }
    | { kind: "donation"; id: string; title: string; name: string; sub: string; ts: string }
    | { kind: "announcement"; id: string; title: string; name: string; sub: string; ts: string };

  const feed: FeedItem[] = [
    ...announcements.slice(0, 6).map((a) => ({
      kind: "announcement" as const,
      id: a.id,
      title: a.title,
      name: a.createdByName,
      sub: a.category.charAt(0).toUpperCase() + a.category.slice(1),
      ts: a.createdAt,
    })),
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
            item.kind === "announcement"
              ? "megaphone"
              : item.kind === "donation"
              ? "gift"
              : isEmergency
              ? "alert-triangle"
              : "life-buoy";
          const iconBg =
            item.kind === "announcement"
              ? "#EFF6FF"
              : item.kind === "donation"
              ? "#EFF6FF"
              : isEmergency
              ? "#F8FAFC"
              : "#DBEAFE";
          const iconColor =
            item.kind === "announcement"
              ? "#0F2747"
              : item.kind === "donation"
              ? "#7C3AED"
              : isEmergency
              ? "#EF4444"
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
                  {item.kind === "donation" ? "🎁 " : item.kind === "announcement" ? "📢 " : ""}
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
    backgroundColor: "#EF4444",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  emergencyPillText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: 0.5 },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

/* ─── main screen ─── */
export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { activeCount } = usePresence();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  function tap(action: () => void) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action();
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "GOOD MORNING";
    if (h < 17) return "GOOD AFTERNOON";
    return "GOOD EVENING";
  };

  const isAdmin = user?.isAdmin ?? false;

  const ACTION_BUTTONS = [
    {
      key: "emergency-assistance",
      icon: "alert-triangle",
      title: "Emergency Assistance",
      sub: "Get urgent support from your community.",
      colors: ["#2563EB", "#0F2747"] as [string, string],
      titleColor: "#FFFFFF",
      subColor: "rgba(255,255,255,0.82)",
      iconSurface: "rgba(239,68,68,0.22)",
      onPress: () => tap(() => router.push("/emergency-assistance" as any)),
    },
    {
      key: "community",
      icon: "map-pin",
      title: "Community Centre",
      sub: "View approved local centres and details.",
      colors: ["#E0F2FE", "#EFF6FF"] as [string, string],
      titleColor: "#0F2747",
      subColor: "#475569",
      iconSurface: "rgba(37,99,235,0.12)",
      borderColor: "#BFDBFE",
      onPress: () => tap(() => router.push("/community-centres" as any)),
    },
    {
      key: "updates",
      icon: "bell",
      title: "Community Updates",
      sub: "Read official community notices.",
      colors: ["#FFFFFF", "#EFF6FF"] as [string, string],
      titleColor: "#0F2747",
      subColor: "#475569",
      iconSurface: "rgba(37,99,235,0.12)",
      borderColor: "#BFDBFE",
      onPress: () => tap(() => router.push("/community-updates" as any)),
    },
    {
      key: "donate",
      icon: "gift",
      title: "Donation",
      sub: "Donate what you can to local community centres.",
      colors: ["#14B8A9", "#2563EB"] as [string, string],
      titleColor: "#FFFFFF",
      subColor: "rgba(255,255,255,0.84)",
      iconSurface: "rgba(255,255,255,0.22)",
      onPress: () => tap(() => router.push("/donation" as any)),
    },
  ];

  if (isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient colors={["#0F2747", "#2563EB", "#14B8A9"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
          <View style={styles.headerRow}>
            <View style={styles.greetingCol}>
              <Text style={styles.greetingSmall}>{greeting()},</Text>
              <Text style={styles.greetingName}>{user?.name?.split(" ")[0] ?? "Friend"}</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable onPress={() => tap(() => router.push("/admin" as any))} style={[styles.adminBtn, { backgroundColor: "#14B8A6" }]}>
                <Feather name="settings" size={14} color="#FFFFFF" />
                <Text style={styles.adminBtnText}>Full View</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/profile" as any)} accessibilityRole="button" accessibilityLabel="Open profile">
                <UserAvatar name={user?.name ?? "U"} size={44} isAdmin />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
          <AdminDashboard />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.communityScroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={["#0F2747", "#2563EB", "#14B8A9"]} style={styles.communityHeader}>
          <View style={styles.communityHeaderTop}>
            <View style={styles.homeBrand}>
              <HelpChainLogo width={100} height={61} light />
              <View style={styles.greetingCol}>
                <Text style={styles.communityGreeting}>{greeting()}</Text>
                <Text style={styles.communityName}>Hi, {user?.name?.split(" ")[0] ?? "Friend"}</Text>
                <View style={styles.activeRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.communityActiveText}>
                    {activeCount > 0 ? `${activeCount} member${activeCount === 1 ? "" : "s"} active` : "Community online"}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/profile" as any)} accessibilityRole="button" accessibilityLabel="Open profile">
              <UserAvatar name={user?.name ?? "U"} size={48} />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={[styles.communityBody, { maxWidth: 1160, alignSelf: "center", width: "100%" }]}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How can we help?</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Four ways to get support</Text>
          </View>
          <View style={styles.actionGrid}>
            {ACTION_BUTTONS.map((button) => (
              <Pressable
                key={button.key}
                onPress={button.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.centerAction, { width: width >= 360 ? "48%" : "100%", opacity: pressed ? 0.86 : 1 }]}
              >
                <LinearGradient
                  colors={button.colors}
                  style={[
                    styles.centerActionInner,
                    {
                      borderColor: button.borderColor ?? "transparent",
                      borderWidth: button.borderColor ? 1 : 0,
                    },
                  ]}
                >
                  <View style={[styles.centerIconRing, { backgroundColor: button.iconSurface }]}>
                    <Feather name={button.icon as any} size={23} color={button.titleColor} />
                  </View>
                  <Text style={[styles.centerActionTitle, { color: button.titleColor }]}>{button.title}</Text>
                  <Text style={[styles.centerActionSub, { color: button.subColor }]}>{button.sub}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── admin inline styles ─── */
const adm = StyleSheet.create({
  statCard: {
    width: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHead: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F8FAFC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  pillText: { fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" },
  viewAll: { fontSize: 12, color: "#2563EB", fontFamily: "Inter_600SemiBold" },
  resolveButton: { minHeight: 30, borderRadius: 7, backgroundColor: "#EFF6FF", paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  resolveText: { color: "#2563EB", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC",
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  rowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E3A5F" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
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
  greetingSmall: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  greetingName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F2747" },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  activeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#10B981" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 12 },
  adminBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  adminBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 16 },
  communityScroll: {
    flexGrow: 1,
  },
  communityHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  communityHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeBrand: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  communityGreeting: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  communityName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: 2,
  },
  communityActiveText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#ECFDF5",
  },
  communityTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 1,
    marginTop: 22,
  },
  communitySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 5,
    maxWidth: 320,
  },
  communityBody: {
    padding: 16,
    gap: 14,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  centerAction: {
    height: 188,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  centerActionInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  centerIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.48)",
    marginBottom: 2,
  },
  centerActionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  centerActionSub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  communityStatus: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  communityStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
  },
  communityStatusEmoji: {
    fontSize: 23,
  },
  communityStatusTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  communityStatusSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  onlineBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#10B981",
    letterSpacing: 0.5,
  },
  // full-screen map overlay
  topOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  greetingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0B1F3A",
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
    shadowColor: "#0B1F3A",
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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.30)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  floatEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  // kept for donate modal
  buttonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionBtn: { borderRadius: 18, overflow: "hidden" },
  actionBtnHalf: { width: "47.5%" },
  actionBtnInner: { padding: 20, alignItems: "center", gap: 10, minHeight: 150, justifyContent: "center" },
  actionIconRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  actionTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  actionSub: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  emergencyModal: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingBottom: 26,
    maxHeight: "88%",
  },
  emergencyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingTop: 18,
    paddingBottom: 14,
  },
  emergencyHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyHeaderEmoji: { fontSize: 24 },
  emergencyModalTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
  },
  emergencyModalSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  emergencyClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyCloseText: {
    fontSize: 27,
    fontFamily: "Inter_400Regular",
    lineHeight: 30,
  },
  emergencyPrompt: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  emergencyServiceList: {
    gap: 9,
    paddingBottom: 12,
  },
  emergencyService: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emergencyServiceEmojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyServiceEmoji: { fontSize: 22 },
  emergencyServiceName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  emergencyServiceDescription: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  emergencyServiceNumber: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  emergencyServiceArrow: {
    fontSize: 28,
    fontFamily: "Inter_400Regular",
  },
  emergencyNote: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 11,
    alignItems: "flex-start",
  },
  emergencyNoteIcon: { fontSize: 16 },
  emergencyNoteText: {
    flex: 1,
    color: "#F59E0B",
    fontSize: 10,
    lineHeight: 15,
    fontFamily: "Inter_400Regular",
  },
  donateModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", gap: 16, paddingBottom: 24 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#DBEAFE", alignSelf: "center", marginTop: 12 },
  modalHeader: { alignItems: "center", padding: 24, gap: 12 },
  modalLogo: { width: 60, height: 60, borderRadius: 16 },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF", textAlign: "center" },
  modalSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
  amountGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap", paddingHorizontal: 24 },
  amountBtn: { flex: 1, minWidth: "40%", height: 52, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  amountText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  donateSendBtn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  donateSendText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
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
