import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DonationItemRequest, useDonations } from "@/context/DonationContext";

function statusLabel(status: DonationItemRequest["status"]): string {
  return status === "approved" ? "Ready for collection" : status.charAt(0).toUpperCase() + status.slice(1);
}

function countdown(deadline: string, now: number): string {
  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function AvailableDonationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { availableItems, itemRequests, requestAvailableItem, getCollectionCode } = useDonations();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const myRequests = itemRequests.filter((request) => request.userId === user?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function submitRequest(itemId: string, available: number) {
    const quantity = Number(quantities[itemId] ?? "1");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > available) {
      Alert.alert("Invalid quantity", `Choose a quantity from 1 to ${available}.`);
      return;
    }
    setBusyId(itemId);
    try {
      await requestAvailableItem(itemId, quantity);
      setQuantities((current) => ({ ...current, [itemId]: "1" }));
      Alert.alert("Request submitted", "Your request is awaiting administrator review.");
    } catch (error) {
      Alert.alert("Request not submitted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function showCode(request: DonationItemRequest) {
    setBusyId(request.id);
    try {
      const code = await getCollectionCode(request.id);
      Alert.alert("Your collection code", `${code}\nShow this code to authorized staff at ${request.communityCentre}.`);
    } catch (error) {
      Alert.alert("Code unavailable", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const activeItems = availableItems.filter((item) =>
    item.active && item.quantityAvailable > 0 && new Date(item.collectionDeadline).getTime() > now
  );

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={20} color="#0F2747" /></Pressable>
        <View><Text style={styles.title}>Available Donations</Text><Text style={styles.subtitle}>Request useful items from your community</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Items near you</Text>
        {activeItems.length === 0 ? <Text style={styles.empty}>There are no donated items available right now.</Text> : activeItems.map((item) => (
          <View key={item.id} style={styles.card}>
            {item.photo ? <Image source={{ uri: item.photo }} style={styles.photo} /> : <View style={[styles.photo, styles.photoEmpty]}><Feather name="gift" size={28} color="#0D9488" /></View>}
            <Text style={styles.itemTitle}>{item.itemName}</Text>
            <Text style={styles.body}>Category: {item.category}</Text>
            <Text style={styles.body}>{item.description}</Text>
            <Text style={styles.body}>Available: {item.quantityAvailable} · {item.communityCentre}</Text>
            <Text style={styles.body}>Added {new Date(item.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.deadline}>Request by {new Date(item.collectionDeadline).toLocaleString()}</Text>
            <View style={styles.controls}>
              <TextInput
                value={quantities[item.id] ?? "1"}
                onChangeText={(value) => setQuantities((current) => ({ ...current, [item.id]: value }))}
                keyboardType="number-pad"
                accessibilityLabel={`Quantity of ${item.itemName}`}
                style={styles.quantity}
              />
              <Pressable disabled={busyId === item.id} onPress={() => submitRequest(item.id, item.quantityAvailable)} style={styles.button}>
                {busyId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Request item</Text>}
              </Pressable>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>My Requests</Text>
        {myRequests.length === 0 ? <Text style={styles.empty}>Your item requests will appear here.</Text> : myRequests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <Text style={styles.itemTitle}>{request.requestId}</Text>
              <Text style={[styles.status, request.status === "approved" && styles.approved]}>{statusLabel(request.status)}</Text>
            </View>
            <Text style={styles.body}>{request.itemName} × {request.quantity}</Text>
            <Text style={styles.body}>{request.communityCentre}</Text>
            {request.reservationExpiresAt && request.status === "approved" && (
              <Text style={styles.deadline}>Collect within: {countdown(request.reservationExpiresAt, now)}</Text>
            )}
            {request.status === "approved" && (
              <Pressable disabled={busyId === request.id} onPress={() => showCode(request)} style={styles.outlineButton}>
                <Text style={styles.outlineText}>{busyId === request.id ? "Loading..." : "Show secure collection code"}</Text>
              </Pressable>
            )}
            {request.status === "collected" && request.collectedAt && (
              <Text style={styles.body}>Collected {new Date(request.collectedAt).toLocaleString()} · Confirmed by {request.confirmedByName ?? "centre staff"}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { minHeight: 72, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#DBEAFE" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EFF6FF" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F2747" },
  subtitle: { marginTop: 3, fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 16, gap: 12 },
  sectionTitle: { marginTop: 8, fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F2747" },
  card: { padding: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: "#DBEAFE", backgroundColor: "#FFFFFF" },
  photo: { width: "100%", height: 170, borderRadius: 10, backgroundColor: "#ECFDF5" },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  body: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: "#475569" },
  deadline: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0D9488" },
  controls: { flexDirection: "row", gap: 8, marginTop: 4 },
  quantity: { width: 74, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 9, paddingHorizontal: 10, color: "#1E3A5F" },
  button: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#0D9488" },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  empty: { padding: 14, borderRadius: 10, backgroundColor: "#FFFFFF", color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular" },
  requestCard: { padding: 13, gap: 7, borderRadius: 12, borderWidth: 1, borderColor: "#DBEAFE", backgroundColor: "#FFFFFF" },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  status: { color: "#64748B", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  approved: { color: "#0D9488" },
  outlineButton: { minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: "#0D9488" },
  outlineText: { color: "#0D9488", fontSize: 11, fontFamily: "Inter_700Bold" },
});
