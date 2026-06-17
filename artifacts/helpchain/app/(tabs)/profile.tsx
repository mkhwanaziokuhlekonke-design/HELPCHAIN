import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
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
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

function MenuItem({
  icon,
  label,
  onPress,
  color,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: (color ?? colors.primary) + "18" }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : (color ?? colors.primary)} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const { requests } = useHelp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  const myRequests = requests.filter((r) => r.requesterId === user?.id);
  const helpedCount = requests.filter((r) => r.helperId === user?.id).length;
  const completedCount = myRequests.filter((r) => r.status === "completed").length;

  function confirmLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login" as any);
        },
      },
    ]);
  }

  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#0F172A", "#1B4FD8"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
        <UserAvatar name={user.name} size={80} isAdmin={user.isAdmin} />
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        {user.isAdmin && (
          <View style={styles.adminBadge}>
            <Feather name="shield" size={12} color="#EA580C" />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          {[
            { label: "Requests", val: myRequests.length, icon: "life-buoy", color: colors.primary },
            { label: "Helped", val: helpedCount, icon: "heart", color: colors.accent },
            { label: "Completed", val: completedCount, icon: "check-circle", color: colors.success },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Feather name={s.icon as any} size={20} color={s.color} />
              <Text style={[styles.statVal, { color: colors.foreground }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "phone", label: "Phone", value: user.phone },
            { icon: "calendar", label: "Member since", value: new Date(user.createdAt).toLocaleDateString() },
          ].map((row) => (
            <View key={row.label} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Feather name={row.icon as any} size={15} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>ACTIONS</Text>
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          {user.isAdmin && (
            <MenuItem
              icon="settings"
              label="Admin Dashboard"
              onPress={() => router.push("/admin" as any)}
              color={colors.accent}
            />
          )}
          <MenuItem
            icon="list"
            label="My Requests"
            onPress={() => router.push("/(tabs)/requests" as any)}
          />
          <MenuItem
            icon="bell"
            label="Notifications"
            onPress={() => router.push("/(tabs)/notifications" as any)}
          />
          <MenuItem
            icon="map-pin"
            label="Update Location Preference"
            onPress={() => router.push("/(auth)/location" as any)}
          />
        </View>

        <View style={[styles.menuGroup, { borderColor: colors.border, marginTop: 8 }]}>
          <MenuItem icon="log-out" label="Sign Out" onPress={confirmLogout} danger />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGrad: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 8,
  },
  userName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginTop: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(234,88,12,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  adminBadgeText: {
    color: "#EA580C",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    padding: 16,
    gap: 12,
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
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statVal: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sectionHead: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginTop: 4,
    marginLeft: 4,
  },
  menuGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderBottomWidth: 0,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
