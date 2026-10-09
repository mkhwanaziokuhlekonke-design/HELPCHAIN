import { Feather } from "@expo/vector-icons";
import { DONATION_ITEMS } from "@/constants/donationItems";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommunityCentre, useCommunityCentres } from "@/context/CommunityCentreContext";
import { DonationDestination } from "@/context/DonationContext";
import { useColors } from "@/hooks/useColors";

type CentreOption = DonationDestination & { details: string; openingHours?: string; contact?: string };

export default function DonationCentresScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ itemType?: string; itemIcon?: string; quantity?: string }>();
  const { centres, loading } = useCommunityCentres();
  const validItems = DONATION_ITEMS.some((item) => item.type === params.itemType);

  const approvedCentres: CentreOption[] = centres.map((centre: CommunityCentre) => ({
    id: centre.id,
    name: centre.name,
    type: "center",
    address: centre.address,
    ...(centre.contact?.trim() ? { contact: centre.contact.trim() } : {}),
    openingHours: centre.openingHours,
    description: centre.description,
    details: centre.description,
  }));
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/donation/register" as any);
  }

  function chooseCentre(centre: CentreOption) {
    if (!validItems) {
      router.replace("/donation/register" as any);
      return;
    }
    router.push({
      pathname: "/donation/confirm",
      params: {
        itemType: params.itemType,
        itemIcon: params.itemIcon || "gift",
        quantity: params.quantity || "1",
        destinationId: centre.id,
        destinationName: centre.name,
        destinationType: centre.type,
        address: centre.address ?? "",
        contact: centre.contact ?? "",
        openingHours: centre.openingHours ?? "",
        description: centre.details,
        ...(centre.latitude !== undefined && centre.longitude !== undefined
          ? { latitude: String(centre.latitude), longitude: String(centre.longitude) }
          : {}),
      },
    } as any);
  }

  function renderCentre(centre: CentreOption) {
    return (
      <View key={centre.id} style={[styles.centre, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.centreTop}>
          <View style={styles.centreIcon}><Feather name="map-pin" size={19} color="#2563EB" /></View>
          <View style={styles.centreBody}>
            <Text style={[styles.centreName, { color: colors.foreground }]}>{centre.name}</Text>
            <Text style={[styles.detail, { color: colors.mutedForeground }]}>{centre.address}</Text>
          </View>
        </View>
        {centre.contact ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>Contact: {centre.contact}</Text> : null}
        {centre.openingHours ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>Hours: {centre.openingHours}</Text> : null}
        {centre.details ? <Text style={[styles.detail, { color: colors.foreground }]}>{centre.details}</Text> : null}
        <Pressable
          onPress={() => chooseCentre(centre)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.chooseButton, { opacity: pressed ? 0.82 : 1 }]}
        >
          <Feather name="check" size={16} color="#FFFFFF" />
          <Text style={styles.chooseButtonText}>Choose Centre</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: colors.background }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Choose Donation Centre</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Select where you will bring your items</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {validItems ? (
            <View style={[styles.itemSummary, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="gift" size={17} color="#0D9488" />
              <Text style={styles.itemSummaryText}>{params.itemType}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Choose donation items before selecting a centre.</Text>
              <Pressable onPress={() => router.replace("/donation/register" as any)} style={styles.chooseButton}>
                <Text style={styles.chooseButtonText}>Back to Items</Text>
              </Pressable>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>HelpChain Community Centres</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : approvedCentres.length ? approvedCentres.map(renderCentre) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No additional HelpChain centres are currently listed.</Text>
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
  inner: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 12 },
  itemSummary: { minHeight: 40, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  itemSummaryText: { color: "#0D9488", fontSize: 13, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 5 },
  centre: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  centreTop: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  centreIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  centreBody: { flex: 1, gap: 3 },
  centreName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  detail: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  chooseButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#14B8A6", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  chooseButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyState: { borderRadius: 10, padding: 18, backgroundColor: "#FFFFFF", gap: 10 },
  emptyText: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
