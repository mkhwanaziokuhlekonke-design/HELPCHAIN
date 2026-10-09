import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useDonations } from "@/context/DonationContext";
import { useEmergencyAlerts } from "@/context/EmergencyAlertContext";
import { useHelp } from "@/context/HelpContext";
import { useReports } from "@/context/ReportContext";

type ActivitySection = "users" | "requests" | "donations" | "reports" | "location";

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  section: ActivitySection;
  icon: string;
  color: string;
}

function timeAgo(iso: string) {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminUserActivityFeed() {
  const router = useRouter();
  const { allUsers, allUsersLoading } = useAuth();
  const { requests, loading: requestsLoading } = useHelp();
  const { donations, loading: donationsLoading } = useDonations();
  const { reports, loading: reportsLoading } = useReports();
  const { emergencyAlerts } = useEmergencyAlerts();

  const loading = allUsersLoading || requestsLoading || donationsLoading || reportsLoading;
  const items: ActivityItem[] = [
    ...allUsers.flatMap((user) => [
      {
        id: `user-created-${user.id}`,
        title: `${user.name} joined HelpChain`,
        detail: user.email,
        time: user.createdAt,
        section: "users" as const,
        icon: "user-plus",
        color: "#2563EB",
      },
      ...(user.updatedAt ? [{
        id: `user-updated-${user.id}`,
        title: `${user.name} updated their profile`,
        detail: user.email,
        time: user.updatedAt,
        section: "users" as const,
        icon: "user",
        color: "#0D9488",
      }] : []),
    ]),
    ...requests.map((request) => {
      const title = request.status === "open"
        ? `${request.requesterName} posted a help request`
        : request.status === "accepted"
          ? `${request.helperName || "A community member"} accepted ${request.requesterName}'s request`
          : `Request "${request.title}" marked ${request.status}`;
      return {
        id: `request-${request.id}`,
        title,
        detail: request.title,
        time: request.status === "open" ? request.createdAt : request.updatedAt || request.createdAt,
        section: "requests" as const,
        icon: request.isEmergency ? "alert-triangle" : "activity",
        color: request.isEmergency ? "#EF4444" : "#10B981",
      };
    }),
    ...donations.map((donation) => ({
      id: `donation-${donation.id}`,
      title: donation.updatedAt
        ? `${donation.donorName}'s donation marked ${donation.status}`
        : `${donation.donorName} donated ${donation.quantity} × ${donation.itemType}`,
      detail: donation.destination?.name || "Donation registered",
      time: donation.updatedAt || donation.createdAt,
      section: "donations" as const,
      icon: "gift",
      color: "#F59E0B",
    })),
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      title: `${report.reporterName} submitted a report`,
      detail: `${report.reason} · ${report.requestTitle} · ${report.status}`,
      time: report.updatedAt || report.createdAt,
      section: "reports" as const,
      icon: "flag",
      color: "#EF4444",
    })),
    ...emergencyAlerts.map((alert) => ({
      id: `emergency-${alert.id}`,
      title: `${alert.userName} contacted emergency services`,
      detail: `${alert.serviceName} · ${alert.serviceNumber}`,
      time: alert.createdAt,
      section: "location" as const,
      icon: "alert-circle",
      color: "#EF4444",
    })),
  ]
    .filter((item) => Number.isFinite(new Date(item.time).getTime()))
    .sort((first, second) => new Date(second.time).getTime() - new Date(first.time).getTime())
    .slice(0, 12);

  function openActivity(item: ActivityItem) {
    router.push({ pathname: "/admin", params: { section: item.section } } as any);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>Live User Activity</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      {loading ? <ActivityIndicator color="#2563EB" /> : items.length ? items.map((item) => (
        <Pressable key={item.id} onPress={() => openActivity(item)} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: `${item.color}18` }]}>
            <Feather name={item.icon as any} size={15} color={item.color} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.detail} numberOfLines={1}>{item.detail}</Text>
          </View>
          <Text style={styles.time}>{timeAgo(item.time)}</Text>
        </Pressable>
      )) : <Text style={styles.empty}>No user activity yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, gap: 4, shadowColor: "#0B1F3A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  heading: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#0D9488" },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#F8FAFC", paddingVertical: 7 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1E3A5F" },
  detail: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
  time: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#64748B" },
  empty: { paddingVertical: 18, color: "#64748B", fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" },
});