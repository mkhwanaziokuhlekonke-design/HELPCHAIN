import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CategoryBadge } from "@/components/CategoryBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { HelpRequest } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

interface HelpRequestCardProps {
  request: HelpRequest;
  compact?: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CONFIG = {
  open: { label: "Open", color: "#16A34A", bg: "#F0FDF4" },
  accepted: { label: "Accepted", color: "#1B4FD8", bg: "#EFF6FF" },
  completed: { label: "Completed", color: "#64748B", bg: "#F1F5F9" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEF2F2" },
};

export function HelpRequestCard({ request, compact = false }: HelpRequestCardProps) {
  const colors = useColors();
  const router = useRouter();
  const status = STATUS_CONFIG[request.status];
  const isWeb = Platform.OS === "web";

  return (
    <Pressable
      onPress={() => router.push(`/request/${request.id}` as any)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: request.isEmergency ? colors.emergency + "40" : colors.border,
          borderWidth: request.isEmergency ? 1.5 : 1,
          opacity: pressed ? 0.92 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isWeb ? 0 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
      ]}
    >
      {request.isEmergency && (
        <View style={[styles.emergencyStrip, { backgroundColor: colors.emergency }]}>
          <Feather name="alert-triangle" size={10} color="#fff" />
          <Text style={styles.emergencyText}>EMERGENCY</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.badges}>
          <CategoryBadge category={request.category} isEmergency={request.isEmergency} size="sm" />
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(request.createdAt)}</Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {request.title}
      </Text>

      {!compact && (
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {request.description}
        </Text>
      )}

      <View style={styles.footer}>
        <View style={styles.requester}>
          <UserAvatar name={request.requesterName} size={24} />
          <Text style={[styles.requesterName, { color: colors.mutedForeground }]}>{request.requesterName}</Text>
        </View>
        {request.location && (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {request.location.address ?? "Location shared"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    overflow: "hidden",
  },
  emergencyStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -14,
    marginHorizontal: -14,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  emergencyText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  requester: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requesterName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
    justifyContent: "flex-end",
  },
  locationText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    maxWidth: 120,
  },
});
