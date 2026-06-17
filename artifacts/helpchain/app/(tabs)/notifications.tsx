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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppNotification, useNotifications } from "@/context/NotificationContext";
import { useColors } from "@/hooks/useColors";

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  emergency_alert: { icon: "alert-triangle", color: "#DC2626" },
  help_accepted: { icon: "check-circle", color: "#1B4FD8" },
  help_offered: { icon: "heart", color: "#EA580C" },
  completed: { icon: "check-circle", color: "#16A34A" },
  system: { icon: "info", color: "#64748B" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const { notifications, markAllRead, markRead, clearAll } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;
  const unread = notifications.filter((n) => !n.read).length;

  function handleNotifPress(n: AppNotification) {
    markRead(n.id);
    if (n.requestId) {
      router.push(`/request/${n.requestId}` as any);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
          {unread > 0 && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{unread} unread</Text>
          )}
        </View>
        {notifications.length > 0 && (
          <Pressable onPress={markAllRead} style={[styles.markBtn, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.markText, { color: colors.primary }]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        scrollEnabled={!!notifications.length}
        renderItem={({ item }) => {
          const cfg = NOTIF_ICONS[item.type] ?? NOTIF_ICONS.system;
          return (
            <Pressable
              onPress={() => handleNotifPress(item)}
              style={({ pressed }) => [
                styles.notifItem,
                {
                  backgroundColor: item.read ? colors.card : colors.secondary,
                  borderBottomColor: colors.border,
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
                <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              You're all caught up! Notifications will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  markBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  markText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  notifItem: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderBottomWidth: 1,
    alignItems: "flex-start",
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
