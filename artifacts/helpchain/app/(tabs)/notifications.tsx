import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppNotification, useNotifications } from "@/context/NotificationContext";
import { useColors } from "@/hooks/useColors";

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  emergency_alert: { icon: "alert-triangle", color: "#EF4444" },
  help_accepted: { icon: "check-circle", color: "#2563EB" },
  help_offered: { icon: "heart", color: "#EF4444" },
  completed: { icon: "check-circle", color: "#10B981" },
  community_update: { icon: "megaphone", color: "#2563EB" },
  donation_registered: { icon: "gift", color: "#0D9488" },
  new_donation: { icon: "gift", color: "#0D9488" },
  system: { icon: "info", color: "#64748B" },
};

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function NotificationsScreen() {
  const colors = useColors();
  const { notifications, loading, error, markAllRead, markRead } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;
  const unread = notifications.filter((n) => !n.read).length;

  function handleNotifPress(n: AppNotification) {
    markRead(n.id);
    if (n.requestId) {
      router.push(`/request/${n.requestId}` as any);
    } else if (n.type === "community_update") {
      router.push("/community-updates" as any);
    } else if (n.type === "donation_registered") {
      router.push("/donation/my-donations" as any);
    } else if (n.type === "new_donation" && n.donationId) {
      router.push({
        pathname: "/admin",
        params: { section: "donations", donationId: n.donationId },
      } as any);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#0F2747", "#2563EB", "#0D9488"]} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerCopy}>
          <View style={styles.headerHeading}>
            <View style={styles.headerIcon}>
              <Feather name="bell" size={19} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Notifications</Text>
          {unread > 0 && (
                <Text style={styles.headerSub}>{unread} unread</Text>
          )}
            </View>
          </View>
        </View>
        {notifications.length > 0 && (
          <Pressable onPress={markAllRead} style={styles.markBtn}>
            <Text style={styles.markText}>Mark all read</Text>
          </Pressable>
        )}
      </LinearGradient>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        scrollEnabled={!loading && !error && !!notifications.length}
        renderItem={({ item }) => {
          const cfg = NOTIF_ICONS[item.type] ?? NOTIF_ICONS.system;
          return (
            <Pressable
              onPress={() => handleNotifPress(item)}
              style={({ pressed }) => [
                styles.notifItem,
                {
                  backgroundColor: item.read ? colors.card : colors.secondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.notifIcon, { backgroundColor: cfg.color + "18" }]}>
                <Feather name={cfg.icon as any} size={20} color={cfg.color} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.notifTop}>
                  <Text style={[styles.notifTitle, { color: colors.foreground }]}>{item.title}</Text>
                  {!item.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{formatDateTime(item.createdAt)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading notifications...</Text>
            </View>
          ) : error ? (
            <View style={styles.empty}>
              <Feather name="alert-circle" size={36} color="#EF4444" />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Notifications unavailable</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
            </View>
          ) : (
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              You're all caught up! Notifications will appear here.
            </Text>
          </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  markBtn: {
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  markText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  listContent: { paddingTop: 12, gap: 10 },
  notifItem: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "flex-start",
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  notifBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
