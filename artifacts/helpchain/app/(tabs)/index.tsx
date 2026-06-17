import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HelpRequestCard } from "@/components/HelpRequestCard";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { requests } = useHelp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [donateVisible, setDonateVisible] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  const emergencyRequests = requests.filter((r) => r.isEmergency && r.status === "open");
  const recentOpen = requests.filter((r) => r.status === "open" && !r.isEmergency).slice(0, 3);

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
      sub: "Post a help request",
      colors: ["#2563EB", "#1D4ED8"] as [string, string],
      onPress: () => tap(() => router.push("/request/new" as any)),
      show: true,
    },
    {
      key: "emergency",
      icon: "alert-triangle",
      title: "Emergency",
      sub: "Get urgent help now",
      colors: ["#DC2626", "#B91C1C"] as [string, string],
      onPress: () =>
        tap(() => {
          router.push("/request/new" as any);
        }),
      show: true,
    },
    {
      key: "chat",
      icon: "message-circle",
      title: "Community Chat",
      sub: "Talk with your community",
      colors: ["#14B8A6", "#0D9488"] as [string, string],
      onPress: () => tap(() => router.push("/(tabs)/chat" as any)),
      show: true,
    },
    {
      key: "donate",
      icon: "gift",
      title: "Donate",
      sub: "Support HelpChain",
      colors: ["#0EA5E9", "#0284C7"] as [string, string],
      onPress: () => tap(() => setDonateVisible(true)),
      show: !isAdmin,
    },
  ];

  const visibleButtons = ACTION_BUTTONS.filter((b) => b.show);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#1F2937", "#1E3A8A"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <View style={styles.greetingCol}>
            <Text style={styles.greetingSmall}>{greeting()},</Text>
            <Text style={styles.greetingName}>{user?.name?.split(" ")[0] ?? "Friend"}</Text>
            <Text style={styles.slogan}>Help together. grow together.</Text>
          </View>
          <View style={styles.headerRight}>
            {isAdmin && (
              <Pressable
                onPress={() => tap(() => router.push("/admin" as any))}
                style={[styles.adminBtn, { backgroundColor: "#14B8A6" }]}
              >
                <Feather name="settings" size={14} color="#fff" />
                <Text style={styles.adminBtnText}>Admin</Text>
              </Pressable>
            )}
            <UserAvatar name={user?.name ?? "U"} size={44} isAdmin={isAdmin} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {emergencyRequests.length > 0 && (
          <Pressable
            onPress={() => router.push(`/request/${emergencyRequests[0].id}` as any)}
            style={[styles.emergencyBanner, { backgroundColor: "#FEF2F2", borderColor: colors.emergency }]}
          >
            <View style={[styles.emergencyIcon, { backgroundColor: colors.emergency }]}>
              <Feather name="alert-triangle" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.emergencyLabel, { color: colors.emergency }]}>
                {emergencyRequests.length} Active Emergency{emergencyRequests.length > 1 ? " Alerts" : ""}
              </Text>
              <Text style={{ color: "#7F1D1D", fontSize: 13, fontFamily: "Inter_500Medium" }} numberOfLines={1}>
                {emergencyRequests[0].title}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.emergency} />
          </Pressable>
        )}

        <View style={styles.statsRow}>
          {[
            { label: "Open", val: requests.filter((r) => r.status === "open").length, color: colors.primary },
            { label: "In Progress", val: requests.filter((r) => r.status === "accepted").length, color: colors.accent },
            { label: "Completed", val: requests.filter((r) => r.status === "completed").length, color: colors.success },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What do you need?</Text>

        <View style={styles.buttonGrid}>
          {visibleButtons.map((btn) => (
            <Pressable
              key={btn.key}
              onPress={btn.onPress}
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.9 : 1 },
                visibleButtons.length % 2 !== 0 && btn === visibleButtons[visibleButtons.length - 1]
                  ? styles.actionBtnFull
                  : styles.actionBtnHalf,
              ]}
            >
              <LinearGradient colors={btn.colors} style={styles.actionBtnInner}>
                <View style={styles.actionIconRing}>
                  <Feather name={btn.icon as any} size={28} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>{btn.title}</Text>
                <Text style={styles.actionSub}>{btn.sub}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        {isAdmin && (
          <View style={[styles.adminInfoCard, { backgroundColor: "#F0FDFA", borderColor: "#14B8A6" }]}>
            <Feather name="info" size={16} color="#14B8A6" />
            <Text style={{ color: "#0F766E", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>
              You have admin access. Use the Admin panel to monitor all activity.
            </Text>
          </View>
        )}

        {recentOpen.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Recent Requests</Text>
              <Pressable onPress={() => router.push("/(tabs)/requests" as any)}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
              </Pressable>
            </View>
            {recentOpen.map((r) => (
              <HelpRequestCard key={r.id} request={r} compact />
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={donateVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.donateModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <LinearGradient colors={["#0EA5E9", "#2563EB"]} style={styles.modalHeader}>
              <Feather name="gift" size={32} color="#fff" />
              <Text style={styles.modalTitle}>Donate to HelpChain</Text>
            </LinearGradient>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Your donation keeps HelpChain free for everyone who needs it.
            </Text>

            <View style={styles.amountGrid}>
              {[5, 10, 25, 50].map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setSelectedAmount(amt)}
                  style={[
                    styles.amountBtn,
                    {
                      borderColor: selectedAmount === amt ? colors.primary : colors.border,
                      backgroundColor: selectedAmount === amt ? colors.secondary : colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.amountText, { color: selectedAmount === amt ? colors.primary : colors.foreground }]}>
                    ${amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                setDonateVisible(false);
                setSelectedAmount(null);
                Alert.alert(
                  "Thank you!",
                  `Your $${selectedAmount ?? 10} donation helps keep HelpChain free for all.\n\n(Demo mode — no real payment processed)`
                );
              }}
              style={[styles.donateSendBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="heart" size={18} color="#fff" />
              <Text style={styles.donateSendText}>Donate {selectedAmount ? `$${selectedAmount}` : ""}</Text>
            </Pressable>

            <Pressable onPress={() => { setDonateVisible(false); setSelectedAmount(null); }} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGrad: {
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 14,
  },
  greetingCol: { gap: 2, flex: 1 },
  greetingSmall: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  greetingName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  slogan: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 12,
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  adminBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  emergencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  emergencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statVal: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionBtn: {
    borderRadius: 18,
    overflow: "hidden",
  },
  actionBtnHalf: {
    width: "47.5%",
  },
  actionBtnFull: {
    width: "100%",
  },
  actionBtnInner: {
    padding: 20,
    alignItems: "center",
    gap: 10,
    minHeight: 150,
    justifyContent: "center",
  },
  actionIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  actionSub: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  adminInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  donateModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    gap: 16,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginTop: 12,
  },
  modalHeader: {
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  modalSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  amountGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    paddingHorizontal: 24,
  },
  amountBtn: {
    flex: 1,
    minWidth: "40%",
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  amountText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  donateSendBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 24,
  },
  donateSendText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
