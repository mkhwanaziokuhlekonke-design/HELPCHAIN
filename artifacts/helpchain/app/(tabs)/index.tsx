import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
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
import { UserAvatar } from "@/components/UserAvatar";
import { LiveLocationMap } from "@/components/LiveLocationMap";
import { useAuth } from "@/context/AuthContext";
import { useDonations } from "@/context/DonationContext";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo.jpeg");

export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { addDonation } = useDonations();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [donateVisible, setDonateVisible] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

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
      sub: "Post a help request",
      colors: ["#2563EB", "#1D4ED8"] as [string, string],
      onPress: () => tap(() => router.push("/request/new" as any)),
    },
    {
      key: "emergency",
      icon: "alert-triangle",
      title: "Emergency",
      sub: "Get urgent help now",
      colors: ["#DC2626", "#B91C1C"] as [string, string],
      onPress: () => tap(() => router.push("/request/new" as any)),
    },
    {
      key: "chat",
      icon: "message-circle",
      title: "Community Chat",
      sub: "Talk with your community",
      colors: ["#14B8A6", "#0D9488"] as [string, string],
      onPress: () => tap(() => router.push("/(tabs)/chat" as any)),
    },
    ...(!isAdmin
      ? [
          {
            key: "donate",
            icon: "gift",
            title: "Donate",
            sub: "Support HelpChain",
            colors: ["#0EA5E9", "#0284C7"] as [string, string],
            onPress: () => tap(() => setDonateVisible(true)),
          },
        ]
      : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#1F2937", "#1E3A8A"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <View style={styles.greetingCol}>
            <Text style={styles.greetingSmall}>{greeting()},</Text>
            <Text style={styles.greetingName}>{user?.name?.split(" ")[0] ?? "Friend"}</Text>
            <Text style={styles.slogan}>Help together. Grow together.</Text>
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
        {/* Live Location Map */}
        <LiveLocationMap />

        {/* Action Buttons */}
        <View style={styles.buttonGrid}>
          {ACTION_BUTTONS.map((btn) => (
            <Pressable
              key={btn.key}
              onPress={btn.onPress}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnHalf,
                { opacity: pressed ? 0.9 : 1 },
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
      </ScrollView>

      {/* Donate Modal */}
      <Modal visible={donateVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.donateModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <LinearGradient colors={["#0EA5E9", "#2563EB"]} style={styles.modalHeader}>
              <Image source={logo} style={styles.modalLogo} resizeMode="contain" />
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
              onPress={async () => {
                const amt = selectedAmount ?? 10;
                setDonateVisible(false);
                setSelectedAmount(null);
                if (user) {
                  await addDonation(user.id, user.name, amt);
                }
                Alert.alert("Thank you!", `Your $${amt} donation has been recorded.\n\n(Demo — no real payment processed)`);
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
    gap: 16,
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
  modalLogo: {
    width: 60,
    height: 60,
    borderRadius: 16,
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
