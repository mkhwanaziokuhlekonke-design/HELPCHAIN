import { Feather } from "@expo/vector-icons";
import { DONATION_ITEMS } from "@/constants/donationItems";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Donation, DonationDestination, useDonations } from "@/context/DonationContext";
import { useColors } from "@/hooks/useColors";

export default function ConfirmDonationScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    itemType?: string;
    itemIcon?: string;
    quantity?: string;
    destinationId?: string;
    destinationName?: string;
    destinationType?: string;
    latitude?: string;
    longitude?: string;
    address?: string;
    contact?: string;
    openingHours?: string;
    description?: string;
  }>();
  const { user } = useAuth();
  const { addDonation } = useDonations();
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDonation, setSavedDonation] = useState<Donation | null>(null);

  const quantity = params.quantity === undefined ? 1 : Number(params.quantity);
  const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const hasCoordinates = Boolean(params.latitude && params.longitude) &&
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasNoCoordinates = !params.latitude && !params.longitude;
  const validDonation =
    DONATION_ITEMS.some((item) => item.type === params.itemType) &&
    Boolean(params.destinationId && params.destinationName) &&
    validQuantity &&
    (hasCoordinates || hasNoCoordinates);

  const destination: DonationDestination = {
    id: params.destinationId ?? "",
    name: params.destinationName ?? "",
    type: params.destinationType === "church" ? "church" : "center",
    ...(hasCoordinates ? { latitude, longitude } : {}),
    ...(params.address ? { address: params.address } : {}),
    ...(params.contact ? { contact: params.contact } : {}),
    ...(params.openingHours ? { openingHours: params.openingHours } : {}),
    ...(params.description ? { description: params.description } : {}),
  };

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/donation/register" as any);
  }

  async function confirmRegistration() {
    if (!validDonation || !user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const donation = await addDonation(
        user.id,
        user.name,
        params.itemType!,
        params.itemIcon || "gift",
        quantity,
        undefined,
        undefined,
        destination
      );
      setSavedDonation(donation);
      setComplete(true);
    } catch (donationError: any) {
      console.error("[DonationConfirm] registration failed:", {
        code: donationError?.code,
        message: donationError?.message,
        operation: "addDonation()",
        donorId: user?.id,
        itemType: params.itemType,
        quantity,
      });
      setError(
        donationError?.message?.includes("permission")
          ? "Firebase rejected the donation because the current Firestore rules do not allow this write. Please publish the rules and try again."
          : donationError?.message?.includes("offline") || donationError?.message?.includes("network")
          ? "Your donation could not be saved because the device is offline. Please check your connection and try again."
          : `Donation could not be registered${donationError?.code ? ` (${donationError.code})` : ""}: ${donationError?.message ?? "Unknown Firebase error."}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {!complete && (
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: colors.background }]}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
        )}
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>{complete ? "Donation registered" : "Confirm donation"}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{complete ? "Thank you for supporting your community" : "Review your item and drop-off location"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          {complete ? (
            <View style={[styles.success, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.successIcon}><Feather name="check" size={28} color="#FFFFFF" /></View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>Donation registered successfully.</Text>
              <View style={styles.successDetails}>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>Item: {savedDonation?.itemType ?? params.itemType}</Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>Quantity: {savedDonation?.quantity ?? quantity}</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>Centre: {savedDonation?.destination?.name ?? destination.name}</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{savedDonation?.destination?.address ?? destination.address}</Text>
                {savedDonation?.createdAt ? (
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>Registered: {new Date(savedDonation.createdAt).toLocaleString()}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => router.replace("/donation/my-donations" as any)} accessibilityRole="button" style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>View My Donations</Text>
                <Feather name="arrow-right" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : !validDonation ? (
            <View style={[styles.review, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="alert-circle" size={24} color="#EF4444" />
              <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Donation details are incomplete</Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>Return to registration and choose an item and a donation location.</Text>
              <Pressable onPress={() => router.replace("/donation/register" as any)} accessibilityRole="button" style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Choose Donation Details</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.reviewHeading}>
                <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Donation summary</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>NON-CASH DONATION</Text>
              </View>

              <View style={[styles.review, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.detailRow}>
                  <View style={styles.iconBox}><Feather name={(params.itemIcon || "gift") as any} size={20} color="#0D9488" /></View>
                  <View style={styles.detailCopy}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM</Text>
                    <Text style={[styles.detailTitle, { color: colors.foreground }]}>{params.itemType} · Qty {quantity}</Text>
                  </View>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <View style={styles.detailRow}>
                  <View style={[styles.iconBox, { backgroundColor: "#EFF6FF" }]}><Feather name="map-pin" size={20} color="#2563EB" /></View>
                  <View style={styles.detailCopy}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>DROP-OFF LOCATION</Text>
                    <Text style={[styles.detailTitle, { color: colors.foreground }]}>{destination.name}</Text>
                    {destination.address ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{destination.address}</Text> : null}
                                        {destination.contact ? <Text style={[styles.body, { color: colors.mutedForeground }]}>Contact: {destination.contact}</Text> : null}
                                        {destination.openingHours ? <Text style={[styles.body, { color: colors.mutedForeground }]}>Hours: {destination.openingHours}</Text> : null}
                                        {destination.description ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{destination.description}</Text> : null}
                    <Text style={[styles.body, { color: colors.mutedForeground }]}>{destination.type === "church" ? "Community donation location" : "Community centre"}</Text>
                  </View>
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={confirmRegistration}
                disabled={submitting}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryButton, { opacity: pressed || submitting ? 0.75 : 1 }]}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="check-circle" size={18} color="#FFFFFF" />}
                <Text style={styles.primaryButtonText}>{submitting ? "Donating..." : "Confirm donation"}</Text>
              </Pressable>
            </>
          )}
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
  inner: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14 },
  reviewHeading: { gap: 4 },
  reviewTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  body: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  review: { borderWidth: 1, borderRadius: 12, padding: 18, gap: 16 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  detailCopy: { flex: 1, gap: 4 },
  label: { fontSize: 10, fontFamily: "Inter_700Bold" },
  detailTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  separator: { height: 1 },
  primaryButton: { minHeight: 50, borderRadius: 8, paddingHorizontal: 16, backgroundColor: "#14B8A6", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  success: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: "center", gap: 12 },
  successIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#14B8A6", alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  successDetails: { alignSelf: "stretch", gap: 4, paddingVertical: 4 },
  error: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});