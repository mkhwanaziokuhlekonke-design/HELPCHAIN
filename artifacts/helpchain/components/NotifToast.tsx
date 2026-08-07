import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "@/context/NotificationContext";
import { useColors } from "@/hooks/useColors";

const NOTIF_META: Record<string, { icon: string; color: string }> = {
  emergency_alert: { icon: "alert-triangle", color: "#DC2626" },
  help_offered:    { icon: "heart",           color: "#EA580C" },
  help_accepted:   { icon: "check-circle",    color: "#1B4FD8" },
  completed:       { icon: "check-circle",    color: "#16A34A" },
  new_request:     { icon: "life-buoy",       color: "#0F766E" },
  new_donation:    { icon: "gift",            color: "#7C3AED" },
  new_message:     { icon: "message-circle",  color: "#2563EB" },
  system:          { icon: "bell",            color: "#64748B" },
};

export function NotifToast() {
  const { latestArrival, dismissArrival } = useNotifications();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!latestArrival) return;

    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();

    // Auto-dismiss after 4 s
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(slideOut, 4000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [latestArrival?.id]);

  function slideOut() {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: -140,
      duration: 280,
      useNativeDriver: true,
    }).start(() => dismissArrival());
  }

  function handlePress() {
    slideOut();
    if (latestArrival?.requestId) {
      router.push(`/request/${latestArrival.requestId}` as any);
    }
  }

  if (!latestArrival) return null;

  const meta = NOTIF_META[latestArrival.type] ?? NOTIF_META.system;
  const topOffset = Platform.OS === "web" ? 72 : insets.top + 10;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: topOffset, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handlePress}
        style={[
          styles.toast,
          {
            backgroundColor: colors.card,
            borderColor: meta.color,
            shadowColor: meta.color,
          },
        ]}
      >
        {/* Coloured left accent bar */}
        <View style={[styles.accent, { backgroundColor: meta.color }]} />

        <View style={[styles.iconWrap, { backgroundColor: meta.color + "22" }]}>
          <Feather name={meta.icon as any} size={20} color={meta.color} />
        </View>

        <View style={styles.textCol}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {latestArrival.title}
          </Text>
          <Text
            style={[styles.body, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {latestArrival.body}
          </Text>
        </View>

        <Pressable onPress={slideOut} hitSlop={12} style={styles.closeBtn}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  accent: {
    width: 4,
    alignSelf: "stretch",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    margin: 12,
    marginRight: 4,
  },
  textCol: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 4,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  closeBtn: {
    padding: 12,
  },
});
