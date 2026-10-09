import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryBadge } from "@/components/CategoryBadge";
import { NavigationMap } from "@/components/NavigationMap";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { useHelp } from "@/context/HelpContext";
import { useLocation } from "@/context/LocationContext";
import { useNotifications } from "@/context/NotificationContext";
import { REPORT_REASONS, ReportReason, useReports } from "@/context/ReportContext";
import { useColors } from "@/hooks/useColors";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS = {
  open: { text: "#10B981", bg: "#ECFDF5" },
  accepted: { text: "#2563EB", bg: "#EFF6FF" },
  completed: { text: "#64748B", bg: "#F8FAFC" },
  cancelled: { text: "#EF4444", bg: "#F8FAFC" },
};

export default function RequestDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRequestById, offerHelp, completeRequest, cancelRequest } = useHelp();
  const { user, updateUserStats } = useAuth();
  const { addNotification } = useNotifications();
  const { createReport } = useReports();
  const { myCoords, userLocations } = useLocation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [showNavMap, setShowNavMap] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const request = getRequestById(id);

  // Auto-reopen navigation when a confirmed helper returns to this screen
  useEffect(() => {
    if (request && user?.id === request.helperId && request.status === "accepted") {
      setShowNavMap(true);
    }
  }, [request?.status, request?.helperId, user?.id]);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  if (!request) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Feather name="alert-circle" size={40} color={colors.muted} />
        <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 }}>Request not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const status = STATUS_COLORS[request.status];
  const isRequester = user?.id === request.requesterId;
  const isHelper = user?.id === request.helperId;
  const canOffer = request.status === "open" && !isRequester;
  const canComplete = (isRequester || isHelper || user?.isAdmin) && request.status === "accepted";
  const canCancel = (isRequester || user?.isAdmin) && (request.status === "open" || request.status === "accepted");

  async function handleSubmitReport() {
    if (!user || !request || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await createReport({ requestId: request.id, requestTitle: request.title, reason: reportReason });
      setReportVisible(false);
      setReportMessage("Report submitted to HelpChain administrators.");
    } catch {
      setReportMessage("The report could not be submitted. Check your connection and try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  // Resolve destination: pinned location first, then requester's live GPS from presence
  const liveRequesterLoc = userLocations.find((u) => u.uid === request.requesterId);
  const destination: { latitude: number; longitude: number; address?: string } | null =
    request.location
      ?? (liveRequesterLoc
        ? { latitude: liveRequesterLoc.latitude, longitude: liveRequesterLoc.longitude }
        : null);

  async function handleOfferHelp() {
    if (!user) return;
    Alert.alert("Offer Help", `Confirm that you'll help with: "${request!.title}"`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, I'll help",
        onPress: async () => {
          setLoading(true);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await offerHelp(request!.id, user.id, user.name);
          await updateUserStats(user.id, "helpOffered");
          await addNotification({
            title: "Help Offered",
            body: `${user.name} is helping with "${request!.title}"`,
            type: "help_offered",
            requestId: request!.id,
          });
          setLoading(false);
          // Always open navigation — uses pinned location or live GPS
          setShowNavMap(true);
        },
      },
    ]);
  }

  async function handleComplete() {
    Alert.alert("Complete Request", "Mark this request as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          setLoading(true);
          await completeRequest(request!.id);
          if (isRequester) await updateUserStats(user!.id, "requestsCreated");
          await addNotification({
            title: "Request Completed",
            body: `"${request!.title}" has been marked as completed.`,
            type: "completed",
            requestId: request!.id,
          });
          setLoading(false);
        },
      },
    ]);
  }

  async function handleCancel() {
    Alert.alert("Cancel Request", "Are you sure you want to cancel this request?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Request",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          await cancelRequest(request!.id);
          setLoading(false);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={["#0F2747", "#2563EB"]}
        style={[styles.header, { paddingTop: topPad }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          {request.isEmergency && (
            <View style={styles.emergencyPill}>
              <Feather name="alert-triangle" size={12} color="#FFFFFF" />
              <Text style={styles.emergencyPillText}>EMERGENCY</Text>
            </View>
          )}
        </View>

        <CategoryBadge category={request.category} isEmergency={request.isEmergency} />
        <Text style={styles.headerTitle}>{request.title}</Text>
        <Text style={styles.headerTime}>{timeAgo(request.createdAt)}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusCard, { backgroundColor: status.bg, borderColor: status.text + "30" }]}>
          <Text style={[styles.statusLabel, { color: status.text }]}>Status: {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
          <Text style={[styles.description, { color: colors.foreground }]}>{request.description}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>REQUESTED BY</Text>
          <View style={styles.personRow}>
            <UserAvatar name={request.requesterName} size={44} />
            <View>
              <Text style={[styles.personName, { color: colors.foreground }]}>{request.requesterName}</Text>
              <Text style={[styles.personRole, { color: colors.mutedForeground }]}>Requester</Text>
            </View>
          </View>
        </View>

        {request.helperId && request.helperName && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>HELPER</Text>
            <View style={styles.personRow}>
              <UserAvatar name={request.helperName} size={44} />
              <View>
                <Text style={[styles.personName, { color: colors.foreground }]}>{request.helperName}</Text>
                <Text style={[styles.personRole, { color: colors.primary }]}>Helping</Text>
              </View>
            </View>
          </View>
        )}

        {request.location && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>LOCATION</Text>
            <View style={styles.locationRow}>
              <View style={[styles.locationIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="map-pin" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.personName, { color: colors.foreground }]}>
                  {request.location.address ?? "Location shared"}
                </Text>
                <Text style={[styles.personRole, { color: colors.mutedForeground }]}>
                  {request.location.latitude.toFixed(4)}, {request.location.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Navigation card — visible when this user is the confirmed helper ── */}
        {isHelper && request.status === "accepted" && (
          <View style={[styles.navCard, { borderColor: "#2563EB30" }]}>
            {/* Header row */}
            <View style={styles.navCardHeader}>
              <View style={styles.navLiveDot} />
              <Text style={styles.navCardTitle}>Navigate to {request.requesterName}</Text>
              <Pressable
                onPress={() => setShowNavMap(true)}
                style={styles.expandBtn}
                hitSlop={8}
              >
                <Feather name="maximize-2" size={16} color="#2563EB" />
              </Pressable>
            </View>

            {/* Embedded mini map — shows when destination is known */}
            {destination ? (
              <View style={styles.miniMapWrap}>
                <NavigationMap
                  requesterCoords={destination}
                  requesterName={request.requesterName}
                  requesterAddress={destination.address}
                  requesterUid={request.requesterId}
                />
              </View>
            ) : (
              <View style={{ height: 120, alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Feather name="map-pin" size={24} color="#64748B" />
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" }}>
                  Waiting for {request.requesterName}'s location…
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#DBEAFE", textAlign: "center" }}>
                  They'll appear on the map when their GPS is active
                </Text>
              </View>
            )}

            {/* Distance / ETA row */}
            {myCoords && destination && (() => {
              const km = Math.sqrt(
                ((myCoords.latitude - destination.latitude) * 111) ** 2 +
                ((myCoords.longitude - destination.longitude) * 111 * Math.cos(myCoords.latitude * Math.PI / 180)) ** 2
              );
              const mins = Math.round((km / 30) * 60);
              return (
                <View style={styles.distRow}>
                  <Feather name="navigation" size={14} color="#2563EB" />
                  <Text style={styles.distText}>
                    {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                    {" · "}
                    {mins < 1 ? "< 1 min" : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`} away
                    {liveRequesterLoc && !request.location && (
                      <Text style={{ color: "#10B981", fontSize: 11, fontFamily: "Inter_400Regular" }}> · Live GPS</Text>
                    )}
                  </Text>
                  <Pressable onPress={() => setShowNavMap(true)} style={styles.fullNavBtn}>
                    <Text style={styles.fullNavBtnText}>Full Map</Text>
                  </Pressable>
                </View>
              );
            })()}
          </View>
        )}

        {/* ── Full-screen navigation modal ── */}
        <Modal
          visible={showNavMap}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setShowNavMap(false)}
        >
          {destination ? (
            <NavigationMap
              requesterCoords={destination}
              requesterName={request.requesterName}
              requesterAddress={destination.address}
              requesterUid={request.requesterId}
              fullScreen
              onClose={() => setShowNavMap(false)}
            />
          ) : (
            /* No destination yet — waiting for live GPS */
            <View style={{ flex: 1, backgroundColor: "#1E3A5F", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#1E3A5F", alignItems: "center", justifyContent: "center" }}>
                <Feather name="map-pin" size={32} color="#2563EB" />
              </View>
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#F8FAFC", textAlign: "center" }}>
                Locating {request.requesterName}…
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 22 }}>
                Navigation will start as soon as their location is available. Make sure they have location sharing enabled.
              </Text>
              <ActivityIndicator color="#2563EB" style={{ marginTop: 8 }} />
              <Pressable
                onPress={() => setShowNavMap(false)}
                style={{ marginTop: 16, backgroundColor: "#1E3A5F", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
              >
                <Text style={{ color: "#64748B", fontFamily: "Inter_500Medium", fontSize: 15 }}>Close</Text>
              </Pressable>
            </View>
          )}
        </Modal>

        <View style={styles.actions}>
          {user && !isRequester && !user.isAdmin && (
            <Pressable
              onPress={() => { setReportMessage(null); setReportVisible(true); }}
              disabled={reportSubmitting}
              style={({ pressed }) => [styles.actionBtnOutline, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Feather name="flag" size={17} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnOutlineText, { color: colors.mutedForeground }]}>Report Request</Text>
            </Pressable>
          )}
          {canOffer && (
            <Pressable
              onPress={handleOfferHelp}
              disabled={loading}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.accent, opacity: pressed || loading ? 0.85 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Feather name="heart" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Offer Help</Text>
                </>
              )}
            </Pressable>
          )}

          {canComplete && (
            <Pressable
              onPress={handleComplete}
              disabled={loading}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.success, opacity: pressed || loading ? 0.85 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Feather name="check-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Mark Complete</Text>
                </>
              )}
            </Pressable>
          )}

          {canCancel && (
            <Pressable
              onPress={handleCancel}
              disabled={loading}
              style={({ pressed }) => [styles.actionBtnOutline, { borderColor: colors.destructive, opacity: pressed || loading ? 0.85 : 1 }]}
            >
              <Feather name="x-circle" size={18} color={colors.destructive} />
              <Text style={[styles.actionBtnOutlineText, { color: colors.destructive }]}>Cancel Request</Text>
            </Pressable>
          )}
        </View>
        {reportMessage && <Text style={styles.reportMessage}>{reportMessage}</Text>}
      </ScrollView>

      <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={() => setReportVisible(false)}>
        <View style={styles.reportOverlay}>
          <View style={[styles.reportDialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.reportDialogTitle, { color: colors.foreground }]}>Report this request</Text>
            <Text style={[styles.personRole, { color: colors.mutedForeground }]}>Choose the reason that best describes the issue.</Text>
            {REPORT_REASONS.map((reason) => {
              const selected = reportReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setReportReason(reason)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.reportReason, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.background }]}
                >
                  <Text style={[styles.personRole, { color: selected ? colors.primary : colors.foreground }]}>{reason}</Text>
                  {selected && <Feather name="check-circle" size={17} color={colors.primary} />}
                </Pressable>
              );
            })}
            <View style={styles.reportDialogActions}>
              <Pressable onPress={() => setReportVisible(false)} style={[styles.reportDialogButton, { backgroundColor: colors.background }]}>
                <Text style={[styles.personRole, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmitReport} disabled={reportSubmitting} style={[styles.reportDialogButton, { backgroundColor: colors.primary, opacity: reportSubmitting ? 0.7 : 1 }]}>
                {reportSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.personRole, { color: "#FFFFFF" }]}>Submit Report</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginBottom: 4,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  emergencyPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  headerTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  scroll: {
    padding: 16,
    gap: 12,
  },
  statusCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  personName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  personRole: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  reportMessage: { marginHorizontal: 20, marginBottom: 18, color: "#0D9488", fontSize: 12, fontFamily: "Inter_500Medium" },
  reportOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 20 },
  reportDialog: { width: "100%", maxWidth: 480, alignSelf: "center", borderRadius: 14, padding: 20, gap: 10 },
  reportDialogTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  reportReason: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportDialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  reportDialogButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtnOutline: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionBtnOutlineText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  // ── Navigation card ──────────────────────────────────────────────────
  navCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: "#EFF6FF",
    overflow: "hidden",
  },
  navCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  navLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  navCardTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F2747",
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapWrap: {
    marginHorizontal: 12,
    marginBottom: 0,
    borderRadius: 12,
    overflow: "hidden",
    height: 200,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  distText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#2563EB",
  },
  fullNavBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  fullNavBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
