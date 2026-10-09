import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useDonations } from "@/context/DonationContext";
import { useColors } from "@/hooks/useColors";

export default function MyDonationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { donations, loading, error, updateDonationStatus } = useDonations();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const myDonations = donations.filter((donation) => donation.donorId === user?.id);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/donation" as any);
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: colors.background }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>My Donations</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Your donated non-cash items</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {loading ? (
            <ActivityIndicator size="large" color="#0D9488" />
          ) : error ? (
            <Text accessibilityRole="alert" style={{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{error}</Text>
          ) : myDonations.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.emptyIcon}><Feather name="gift" size={22} color="#0D9488" /></View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No donated items yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>The items you donate will appear here.</Text>
              <Pressable onPress={() => router.replace("/donation" as any)} accessibilityRole="button" style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Donate</Text>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : myDonations.map((donation) => (
            <View key={donation.id} style={[styles.donation, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.donationHeader}>
                <View style={styles.donationIcon}><Feather name="gift" size={18} color="#0D9488" /></View>
                <View style={styles.donationMain}>
                  <Text style={[styles.item, { color: colors.foreground }]}>{donation.itemType}</Text>
                  <Text style={[styles.quantity, { color: colors.mutedForeground }]}>Donation ID: {donation.donationId ?? donation.id}</Text>
                  <Text style={[styles.quantity, { color: colors.mutedForeground }]}>Quantity: {donation.quantity} · Status: {donation.status.replaceAll("-", " ")}</Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.details}>
                <View style={styles.detailRow}>
                  <Feather name="map-pin" size={14} color="#2563EB" />
                  <Text style={[styles.detailText, { color: colors.foreground }]}>{donation.destination?.name ?? "Centre details unavailable"}</Text>
                </View>
                {donation.destination?.address ? (
                  <Text style={[styles.address, { color: colors.mutedForeground }]}>{donation.destination.address}</Text>
                ) : null}
                <View style={styles.detailRow}>
                  <Feather name="calendar" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.date, { color: colors.mutedForeground }]}>{new Date(donation.createdAt).toLocaleString()}</Text>
                </View>
                {donation.receivedAt ? (
                  <View style={styles.receipt}>
                    <Text style={styles.receiptTitle}>✓ Received / Verified</Text>
                    <Text style={[styles.address, { color: colors.mutedForeground }]}>
                      {donation.quantityReceived ?? donation.quantity} received at {donation.receivedCentreName ?? donation.destination?.name ?? "community centre"} on {new Date(donation.receivedAt).toLocaleString()}
                    </Text>
                    {donation.receivedByName ? <Text style={[styles.address, { color: colors.mutedForeground }]}>Confirmed by {donation.receivedByName}</Text> : null}
                    {donation.proofPhoto ? <Image source={{ uri: donation.proofPhoto }} style={styles.proof} resizeMode="cover" /> : null}
                  </View>
                ) : null}
                {donation.status === "pending-delivery" ? (
                  <Pressable
                    disabled={updatingId === donation.id}
                    onPress={async () => {
                      setUpdatingId(donation.id);
                      try {
                        await updateDonationStatus(donation.id, "delivered");
                        Alert.alert("Delivery reported", "The receiving centre must still verify physical receipt.");
                      } catch (updateError) {
                        Alert.alert("Could not update delivery", updateError instanceof Error ? updateError.message : "Please try again.");
                      } finally {
                        setUpdatingId(null);
                      }
                    }}
                    style={styles.deliveredButton}
                  >
                    <Text style={styles.deliveredText}>{updatingId === donation.id ? "Updating..." : "I handed over these items"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 76, paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1 },
  backButton: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  content: { width: "100%", padding: 20, paddingBottom: 32 },
  inner: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 12 },
  empty: { borderWidth: 1, borderRadius: 12, padding: 28, alignItems: "center", gap: 9 },
  emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", textAlign: "center" },
  donation: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  donationHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  donationIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  donationMain: { flex: 1, gap: 3 },
  item: { fontSize: 14, fontFamily: "Inter_700Bold" },
  quantity: { fontSize: 12, fontFamily: "Inter_400Regular" },
  divider: { height: 1 },
  details: { gap: 7 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  detailText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  address: { paddingLeft: 21, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  receipt: { marginTop: 5, padding: 11, gap: 4, borderRadius: 9, backgroundColor: "#ECFDF5" },
  receiptTitle: { color: "#0D9488", fontSize: 12, fontFamily: "Inter_700Bold" },
  proof: { width: "100%", height: 180, marginTop: 5, borderRadius: 9 },
  deliveredButton: { minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#2563EB" },
  deliveredText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  primaryButton: { minHeight: 46, marginTop: 6, paddingHorizontal: 15, borderRadius: 8, backgroundColor: "#14B8A6", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
});
