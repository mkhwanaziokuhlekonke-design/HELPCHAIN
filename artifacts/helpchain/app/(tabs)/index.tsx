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

  function handlePress(action: () => void) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action();
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#0F172A", "#1E3A8A"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <View style={styles.greetingCol}>
            <Text style={styles.greetingSmall}>{greeting()},</Text>
            <Text style={styles.greetingName}>{user?.name?.split(" ")[0] ?? "Friend"}</Text>
          </View>
          <View style={styles.headerRight}>
            {user?.isAdmin && (
              <Pressable
                onPress={() => handlePress(() => router.push("/admin" as any))}
                style={[styles.adminBtn, { backgroundColor: colors.accent }]}
              >
                <Feather name="settings" size={14} color="#fff" />
                <Text style={styles.adminBtnText}>Admin</Text>
              </Pressable>
            )}
            <UserAvatar name={user?.name ?? "U"} size={42} isAdmin={user?.isAdmin} />
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
              <Text style={[styles.emergencyTitle, { color: "#7F1D1D" }]} numberOfLines={1}>
                {emergencyRequests[0].title}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.emergency} />
          </Pressable>
        )}

        <View style={styles.statsRow}>
          {[
            { label: "Open Requests", val: requests.filter((r) => r.status === "open").length, color: colors.primary },
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

        <View style={styles.actionButtons}>
          <Pressable
            onPress={() => handlePress(() => router.push("/request/new" as any))}
            style={({ pressed }) => [styles.bigBtn, { opacity: pressed ? 0.92 : 1 }]}
          >
            <LinearGradient colors={["#1B4FD8", "#1E40AF"]} style={styles.bigBtnInner}>
              <Feather name="life-buoy" size={36} color="#fff" />
              <Text style={styles.bigBtnTitle}>Request Help</Text>
              <Text style={styles.bigBtnSub}>Post a request for assistance</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => handlePress(() => router.push("/(tabs)/requests" as any))}
            style={({ pressed }) => [styles.bigBtn, { opacity: pressed ? 0.92 : 1 }]}
          >
            <LinearGradient colors={["#EA580C", "#C2410C"]} style={styles.bigBtnInner}>
              <Feather name="heart" size={36} color="#fff" />
              <Text style={styles.bigBtnTitle}>Offer Help</Text>
              <Text style={styles.bigBtnSub}>Browse open requests</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setDonateVisible(true)}
          style={({ pressed }) => [styles.donateBtn, { borderColor: colors.accent, backgroundColor: colors.orangeLight, opacity: pressed ? 0.9 : 1 }]}
        >
          <Feather name="gift" size={20} color={colors.accent} />
          <Text style={[styles.donateBtnText, { color: colors.accent }]}>Donate to HelpChain</Text>
          <Feather name="chevron-right" size={16} color={colors.accent} />
        </Pressable>

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
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Donate to HelpChain</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Your donation helps keep HelpChain free for everyone who needs it.
            </Text>

            <View style={styles.amountGrid}>
              {[5, 10, 25, 50].map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setSelectedAmount(amt)}
                  style={[
                    styles.amountBtn,
                    {
                      borderColor: selectedAmount === amt ? colors.accent : colors.border,
                      backgroundColor: selectedAmount === amt ? colors.orangeLight : colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.amountText, { color: selectedAmount === amt ? colors.accent : colors.foreground }]}>
                    ${amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                setDonateVisible(false);
                Alert.alert("Thank you!", `Your $${selectedAmount ?? 10} donation helps keep HelpChain free for all. (Demo mode — no real payment processed)`);
              }}
              style={[styles.donateSendBtn, { backgroundColor: colors.accent }]}
            >
              <Feather name="heart" size={18} color="#fff" />
              <Text style={styles.donateSendText}>Donate {selectedAmount ? `$${selectedAmount}` : ""}</Text>
            </Pressable>

            <Pressable onPress={() => setDonateVisible(false)} style={styles.cancelBtn}>
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
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  greetingCol: { gap: 2 },
  greetingSmall: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  greetingName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    marginBottom: 2,
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
  emergencyTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
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
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  bigBtn: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  bigBtnInner: {
    padding: 20,
    alignItems: "center",
    gap: 10,
    minHeight: 160,
    justifyContent: "center",
  },
  bigBtnTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  bigBtnSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  donateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  donateBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  donateModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  modalSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  amountGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
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
