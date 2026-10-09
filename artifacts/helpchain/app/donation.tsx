import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { DONATION_ITEMS } from "@/constants/donationItems";
import { DEFAULT_DONATION_INSTRUCTIONS, useDonationInformation } from "@/context/DonationInformationContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";


export default function DonationScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { instructions } = useDonationInformation();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as any);
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: colors.background }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Donation</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Give what you can to local communities</Text>
        </View>
        <View style={styles.logo}>
          <Feather name="gift" size={19} color="#0D9488" />
        </View>
      </View>

      <ScrollView contentContainerStyle={landing.content} showsVerticalScrollIndicator={false}>
        <View style={landing.inner}>
          <LinearGradient colors={["#0F2747", "#2563EB", "#0D9488"]} style={landing.hero}>
            <View style={landing.heroIcon}><Feather name="gift" size={25} color="#FFFFFF" /></View>
            <Text style={landing.heroEyebrow}>GIVE WHAT YOU CAN</Text>
            <Text style={landing.heroTitle}>Small acts make a big difference.</Text>
            <Text style={landing.heroBody}>Share what you can with neighbours through trusted community centres.</Text>
            <View pointerEvents="none" style={landing.heroOrb} />
          </LinearGradient>

          <View style={[styles.notice, { borderColor: colors.border }]}>
            <View style={styles.noticeIcon}><Feather name="heart" size={21} color="#0D9488" /></View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>ANYTHING YOU CAN DONATE</Text>
              <Text style={styles.noticeBody}>{instructions || DEFAULT_DONATION_INSTRUCTIONS}</Text>
            </View>
          </View>

          <View style={[landing.examples, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[landing.examplesTitle, { color: colors.foreground }]}>What you can donate</Text>
            <View style={landing.exampleList}>
              {DONATION_ITEMS.map((item) => (
                <View key={item.type} style={landing.example}>
                  <Feather name={item.icon as any} size={14} color="#0D9488" />
                  <Text style={[landing.exampleText, { color: colors.foreground }]}>{item.type}</Text>
                </View>
              ))}
            </View>
            <Text style={[landing.exampleNote, { color: colors.mutedForeground }]}>Non-cash items only. Money, electronics and unsafe items cannot be accepted.</Text>
          </View>

          <Pressable
            onPress={() => router.push("/donation/register" as any)}
            accessibilityRole="button"
            style={({ pressed }) => [landing.registerButton, { opacity: pressed ? 0.84 : 1 }]}
          >
            <Feather name="gift" size={19} color="#FFFFFF" />
            <Text style={landing.registerText}>Donate</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/donation/my-donations" as any)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.centresLink, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="clock" size={18} color="#0D9488" />
            <Text style={[styles.centresLinkText, { color: "#0D9488" }]}>View my donation history</Text>
            <Feather name="arrow-up-right" size={16} color="#0D9488" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/donation/available" as any)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.centresLink, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="shopping-bag" size={18} color="#0D9488" />
            <Text style={[styles.centresLinkText, { color: "#0D9488" }]}>Available Donations · My Requests</Text>
            <Feather name="arrow-up-right" size={16} color="#0D9488" />
          </Pressable>

          {user?.isCentreReceiver && (
            <Pressable
              onPress={() => router.push("/donation/receive" as any)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.centresLink, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="check-circle" size={18} color="#2563EB" />
              <Text style={styles.centresLinkText}>Community Centre verification</Text>
              <Feather name="arrow-up-right" size={16} color="#2563EB" />
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push("/community-centres" as any)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.centresLink, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="map-pin" size={18} color="#2563EB" />
            <Text style={styles.centresLinkText}>View approved Community Centres</Text>
            <Feather name="arrow-up-right" size={16} color="#2563EB" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function DonationRegistrationScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<(typeof DONATION_ITEMS)[number] | null>(null);
  const [quantity, setQuantity] = useState(1);
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as any);
  }

  function reviewDonation() {
    if (!selectedItem) return;
    router.push({
      pathname: "/donation/centres",
      params: {
        itemType: selectedItem.type,
        itemIcon: selectedItem.icon,
        quantity: String(quantity),
      },
    } as any);
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: colors.background }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Donate an Item</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Choose items and an approved drop-off location</Text>
        </View>
        <View style={styles.logo}>
          <Feather name="gift" size={19} color="#0D9488" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.contentInner}>
          <View style={[styles.formPanel, { width: "100%", backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>Choose your items</Text>
              <Text style={[styles.panelHint, { color: colors.mutedForeground }]}>Choose anything you would like to donate. Money and electronics are not accepted.</Text>
              <View style={styles.itemGrid}>
                {DONATION_ITEMS.map((item) => {
                  const selected = selectedItem?.type === item.type;
                  return (
                    <Pressable
                      key={item.type}
                      onPress={() => setSelectedItem(item)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.itemButton, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? "#DBEAFE" : colors.card }]}
                    >
                      <Feather name={item.icon as any} size={19} color={selected ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.itemText, { color: selected ? colors.primary : colors.foreground }]}>{item.type}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.quantityRow}>
                <View style={styles.quantityCopy}>
                  <Text style={[styles.quantityTitle, { color: colors.foreground }]}>Quantity</Text>
                  <Text style={[styles.quantityHint, { color: colors.mutedForeground }]}>Number of items to donate</Text>
                </View>
                <View style={[styles.quantityControl, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Pressable
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease quantity"
                    style={styles.quantityButton}
                  >
                    <Feather name="minus" size={16} color={colors.primary} />
                  </Pressable>
                  <Text style={[styles.quantityValue, { color: colors.foreground }]}>{quantity}</Text>
                  <Pressable
                    onPress={() => setQuantity((current) => current + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Increase quantity"
                    style={styles.quantityButton}
                  >
                    <Feather name="plus" size={16} color={colors.primary} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={reviewDonation}
                accessibilityRole="button"
                disabled={!selectedItem}
                style={({ pressed }) => [styles.submitButton, { opacity: pressed || !selectedItem ? 0.65 : 1 }]}
              >
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Donate</Text>
              </Pressable>
            </View>
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
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  content: { width: "100%", padding: 20, paddingBottom: 34 },
  contentInner: { width: "100%", maxWidth: 1200, alignSelf: "center", gap: 14 },
  notice: { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE", borderWidth: 1, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  noticeIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: "#0D9488", fontSize: 13, fontFamily: "Inter_700Bold" },
  noticeBody: { color: "#0F2747", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  centresLink: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  centresLinkText: { flex: 1, color: "#2563EB", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  columns: { gap: 14 },
  columnsWide: { flexDirection: "row", alignItems: "flex-start" },
  mapPanel: { gap: 5 },
    officialCentres: { gap: 8, marginTop: 8 },
    officialTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
    officialCentre: { minHeight: 88, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    officialCentreCopy: { flex: 1, gap: 3 },
    officialCentreName: { fontSize: 13, fontFamily: "Inter_700Bold" },
    officialCentreDetail: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  formPanel: { gap: 12, borderWidth: 1, borderRadius: 12, padding: 18 },
  panelWide: { flex: 1, minWidth: 0 },
  panelTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  panelHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 5 },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  itemButton: { minHeight: 48, minWidth: 108, flexGrow: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  itemText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  submitButton: { minHeight: 50, borderRadius: 12, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 4 },
  submitText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 },
  quantityCopy: { flex: 1, gap: 3 },
  quantityTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  quantityHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  quantityControl: { minHeight: 42, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  quantityButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  quantityValue: { minWidth: 30, textAlign: "center", fontSize: 15, fontFamily: "Inter_700Bold" },
});

const landing = StyleSheet.create({
  content: { width: "100%", padding: 20, paddingBottom: 34 },
  inner: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 14 },
  hero: { minHeight: 210, overflow: "hidden", borderRadius: 20, padding: 22, gap: 8, justifyContent: "center" },
  heroIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 3 },
  heroEyebrow: { color: "#99F6E4", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  heroTitle: { maxWidth: 470, color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontFamily: "Inter_700Bold" },
  heroBody: { maxWidth: 470, color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  heroOrb: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 24, borderColor: "rgba(255,255,255,0.08)", right: -26, top: 42 },
  examples: { borderWidth: 1, borderRadius: 12, padding: 18, gap: 12 },
  examplesTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  exampleList: { flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 12 },
  example: { minWidth: 130, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  exampleText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  exampleNote: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  registerButton: { minHeight: 54, borderRadius: 12, paddingHorizontal: 18, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  registerText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
});