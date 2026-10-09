import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useEmergencyAlerts } from "@/context/EmergencyAlertContext";
import { useHelp } from "@/context/HelpContext";
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

const EMERGENCY_SERVICES = [
  { key: "police", emoji: "👮", name: "South African Police", number: "10111", description: "Crime, danger, or immediate police assistance", color: "#2563EB" },
  { key: "ambulance-fire", emoji: "🚑", name: "Ambulance & Fire", number: "10177", description: "Medical emergency, ambulance, or fire rescue", color: "#EF4444" },
  { key: "mobile-emergency", emoji: "📱", name: "Mobile Emergency", number: "112", description: "Emergency services from a mobile phone", color: "#0F2747" },
  { key: "er24", emoji: "❤️", name: "ER24", number: "084 124", description: "Private ambulance and medical response", color: "#14B8A6" },
  { key: "netcare-911", emoji: "🏥", name: "Netcare 911", number: "082 911", description: "Private emergency medical response", color: "#2563EB" },
] as const;

export default function EmergencyAssistanceScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { requests, loading: requestsLoading } = useHelp();
  const { createEmergencyAlert } = useEmergencyAlerts();
  const { myCoords } = useLocation();
  const { width } = useWindowDimensions();
  const myEmergencyRequests = requests
    .filter((request) => request.requesterId === user?.id && request.isEmergency)
    .slice(0, 3);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as any);
  }

  async function callEmergencyService(service: (typeof EMERGENCY_SERVICES)[number]) {
    let location: { latitude: number; longitude: number; address?: string } | undefined = myCoords
      ? { latitude: myCoords.latitude, longitude: myCoords.longitude }
      : undefined;

    if (!location) {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          let address: string | undefined;
          try {
            const places = await Location.reverseGeocodeAsync({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            if (places[0]) {
              const place = places[0];
              address = [place.name, place.street, place.city, place.region].filter(Boolean).join(", ");
            }
          } catch {}
          location = { latitude: position.coords.latitude, longitude: position.coords.longitude, address };
        }
      } catch {}
    }

    try {
      await createEmergencyAlert({
        serviceKey: service.key,
        serviceName: service.name,
        serviceNumber: service.number,
        location,
      });
    } catch (error) {
      console.warn("[Emergency] Could not save admin alert:", error);
    }

    const callUrl = `tel:${service.number.replace(/\s/g, "")}`;
    try {
      const canCall = Platform.OS === "web" || await Linking.canOpenURL(callUrl);
      if (!canCall) throw new Error("calling unavailable");
      await Linking.openURL(callUrl);
    } catch {
      Alert.alert("Calling unavailable", `Please call ${service.number} manually for ${service.name}.`);
    }
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: colors.background }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Emergency Assistance</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>HelpChain emergency support</Text>
        </View>
        <Feather name="shield" size={21} color="#2563EB" />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentInner}>
          <LinearGradient colors={["#0F2747", "#2563EB", "#0D9488"]} style={styles.hero}>
            <View style={styles.heroIcon}><Feather name="life-buoy" size={29} color="#FFFFFF" /></View>
            <View style={styles.heroCopy}>
              <View style={styles.urgentPill}>
                <View style={styles.urgentDot} />
                <Text style={styles.heroEyebrow}>URGENT SUPPORT</Text>
              </View>
              <Text style={styles.heroTitle}>Request emergency help</Text>
              <Text style={styles.heroBody}>Create an urgent HelpChain request for nearby community support.</Text>
            </View>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/request/new", params: { emergency: "1" } } as any);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.requestButton, { opacity: pressed ? 0.84 : 1 }]}
            >
              <Text style={styles.requestButtonText}>Request Emergency Help</Text>
              <Feather name="arrow-right" size={17} color="#2563EB" />
            </Pressable>
            <View pointerEvents="none" style={styles.heroOrb} />
          </LinearGradient>

          <View style={[styles.warning, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={18} color="#EF4444" />
            <Text style={[styles.warningText, { color: colors.foreground }]}>For immediate danger, call emergency services directly. HelpChain requests notify the community; they do not replace emergency responders.</Text>
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My emergency requests</Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Live status from your HelpChain requests</Text>
            </View>
          </View>
          {requestsLoading ? (
            <View style={[styles.requestStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myEmergencyRequests.length ? (
            myEmergencyRequests.map((request) => {
              const statusLabel = request.status === "open"
                ? "Pending"
                : request.status === "accepted"
                  ? "In Progress"
                  : request.status === "completed"
                    ? "Resolved"
                    : "Cancelled";
              const statusColor = request.status === "completed"
                ? "#0D9488"
                : request.status === "accepted"
                  ? "#2563EB"
                  : request.status === "cancelled"
                    ? colors.mutedForeground
                    : "#F59E0B";
              return (
                <Pressable
                  key={request.id}
                  onPress={() => router.push(`/request/${request.id}` as any)}
                  accessibilityRole="button"
                  style={[styles.requestStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.requestStatusIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="alert-triangle" size={17} color={colors.primary} />
                  </View>
                  <View style={styles.requestStatusCopy}>
                    <Text style={[styles.requestStatusTitle, { color: colors.foreground }]} numberOfLines={1}>{request.title}</Text>
                    <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{request.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={[styles.requestStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="shield" size={18} color={colors.teal} />
              <Text style={[styles.requestEmpty, { color: colors.mutedForeground }]}>You have no emergency requests yet.</Text>
            </View>
          )}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Emergency contacts</Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Tap a contact to open your phone app</Text>
            </View>
            {user?.phone ? <Text style={[styles.yourPhone, { color: colors.mutedForeground }]}>Your phone: {user.phone}</Text> : null}
          </View>

          <View style={styles.contactGrid}>
            {EMERGENCY_SERVICES.map((service) => (
              <Pressable
                key={service.key}
                onPress={() => callEmergencyService(service)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${service.name} at ${service.number}`}
                style={({ pressed }) => [
                  styles.contactCard,
                  { width: width >= 960 ? "48.8%" : "100%", backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.contactIcon, { backgroundColor: `${service.color}16` }]}>
                  <Text style={styles.contactEmoji}>{service.emoji}</Text>
                </View>
                <View style={styles.contactCopy}>
                  <Text style={[styles.contactName, { color: colors.foreground }]}>{service.name}</Text>
                  <Text style={[styles.contactDescription, { color: colors.mutedForeground }]}>{service.description}</Text>
                  <Text style={[styles.contactNumber, { color: service.color }]}>Call {service.number}</Text>
                </View>
                <Feather name="phone" size={18} color={service.color} />
              </Pressable>
            ))}
          </View>
          <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>When your phone opens, confirm the call. Emergency alert details are shared with authorised HelpChain administrators.</Text>
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
  contentInner: { width: "100%", maxWidth: 1120, alignSelf: "center", gap: 16 },
  hero: { minHeight: 220, borderRadius: 20, padding: 24, flexDirection: "row", alignItems: "center", gap: 20, flexWrap: "wrap", overflow: "hidden" },
  heroIcon: { width: 62, height: 62, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.17)" },
  heroCopy: { flex: 1, minWidth: 210, gap: 5 },
  urgentPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(239,68,68,0.22)" },
  urgentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FCA5A5" },
  heroEyebrow: { color: "#FECACA", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontFamily: "Inter_700Bold" },
  heroBody: { color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  heroOrb: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 22, borderColor: "rgba(255,255,255,0.08)", top: 40, right: -24 },
  requestButton: { minHeight: 48, borderRadius: 12, backgroundColor: "#FFFFFF", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  requestButtonText: { color: "#2563EB", fontSize: 13, fontFamily: "Inter_700Bold" },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 10, padding: 14 },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium" },
  requestStatusCard: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderRadius: 15 },
  requestStatusIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  requestStatusCopy: { flex: 1, gap: 4 },
  requestStatusTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  requestEmpty: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionHeading: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  yourPhone: { fontSize: 11, fontFamily: "Inter_500Medium" },
  contactGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  contactCard: { minHeight: 112, borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  contactIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  contactEmoji: { fontSize: 22 },
  contactCopy: { flex: 1, gap: 3 },
  contactName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  contactDescription: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular" },
  contactNumber: { fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2 },
  footerNote: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
});