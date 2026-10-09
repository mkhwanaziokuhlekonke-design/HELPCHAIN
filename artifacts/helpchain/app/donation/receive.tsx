import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useDonations } from "@/context/DonationContext";

const PHOTO_LIMIT = 700_000;

export default function DonationReceiverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { confirmDonationReceipt, confirmItemCollection } = useDonations();
  const [donationId, setDonationId] = useState("");
  const [quantityReceived, setQuantityReceived] = useState("");
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");
  const [collectionCode, setCollectionCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function chooseProofPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission required", "Allow photo access to attach receipt proof.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.35,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if (!asset.base64 || asset.base64.length > PHOTO_LIMIT) {
      Alert.alert("Photo too large", "Choose a smaller or cropped photo.");
      return;
    }
    setProofPhoto(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
  }

  async function verifyReceipt() {
    const quantity = Number(quantityReceived);
    if (!donationId.trim() || !Number.isSafeInteger(quantity) || quantity < 1) {
      Alert.alert("Details required", "Enter the Donation ID and the quantity physically received.");
      return;
    }
    setBusy(true);
    try {
      await confirmDonationReceipt(donationId.trim(), quantity, proofPhoto ?? undefined);
      setDonationId("");
      setQuantityReceived("");
      setProofPhoto(null);
      Alert.alert("Receipt verified", "The receiving centre confirmation and audit entry were recorded.");
    } catch (error) {
      Alert.alert("Could not verify receipt", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCollection() {
    if (!requestId.trim() || !/^\d{8}$/.test(collectionCode)) {
      Alert.alert("Details required", "Enter the item request ID and its 8-digit collection code.");
      return;
    }
    setBusy(true);
    try {
      await confirmItemCollection(requestId.trim(), collectionCode);
      setRequestId("");
      setCollectionCode("");
      Alert.alert("Collection confirmed", "Inventory and the permanent collection audit were updated.");
    } catch (error) {
      Alert.alert("Could not confirm collection", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!user?.isCentreReceiver || !(user.authorizedCentreIds?.length)) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.header}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={20} color="#0F2747" /></Pressable><Text style={styles.title}>Centre verification</Text></View>
        <View style={styles.denied}><Feather name="shield" size={30} color="#0D9488" /><Text style={styles.body}>Only an administrator-authorized community centre receiver can verify donations or collections.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={20} color="#0F2747" /></Pressable>
        <View><Text style={styles.title}>Centre verification</Text><Text style={styles.subtitle}>Authorized centres: {user.authorizedCentreIds.length}</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verify donated item receipt</Text>
          <Text style={styles.body}>Enter the donor's Donation ID when the physical items arrive. Confirmation is restricted to your assigned centre.</Text>
          <TextInput value={donationId} onChangeText={setDonationId} autoCapitalize="characters" placeholder="Donation ID · HC-000124" style={styles.input} />
          <TextInput value={quantityReceived} onChangeText={setQuantityReceived} keyboardType="number-pad" placeholder="Quantity physically received" style={styles.input} />
          {proofPhoto && <Image source={{ uri: proofPhoto }} style={styles.proof} />}
          <Pressable onPress={chooseProofPhoto} style={styles.outlineButton}>
            <Feather name="camera" size={16} color="#2563EB" /><Text style={styles.outlineText}>{proofPhoto ? "Change receipt photo" : "Add proof photo"}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={verifyReceipt} style={[styles.button, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Confirm physical receipt</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Confirm item collection</Text>
          <Text style={styles.body}>Verify the member's approved request ID and their private collection code before handing over reserved items.</Text>
          <TextInput value={requestId} onChangeText={setRequestId} autoCapitalize="characters" placeholder="Request ID · HC-R-XXXXXXXX" style={styles.input} />
          <TextInput value={collectionCode} onChangeText={setCollectionCode} keyboardType="number-pad" maxLength={8} placeholder="8-digit collection code" style={styles.input} />
          <Pressable disabled={busy} onPress={verifyCollection} style={[styles.button, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Confirm item collection</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { minHeight: 70, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#DBEAFE" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EFF6FF" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#0F2747" },
  subtitle: { marginTop: 3, fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  content: { width: "100%", maxWidth: 700, alignSelf: "center", padding: 16, gap: 14 },
  card: { padding: 15, gap: 10, borderRadius: 13, borderWidth: 1, borderColor: "#DBEAFE", backgroundColor: "#FFFFFF" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F2747" },
  body: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: "#64748B" },
  input: { minHeight: 43, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC", color: "#1E3A5F", fontSize: 13 },
  proof: { width: "100%", height: 180, borderRadius: 9 },
  outlineButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 9, borderWidth: 1, borderColor: "#BFDBFE" },
  outlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#2563EB" },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#0D9488" },
  disabled: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  denied: { flex: 1, padding: 26, alignItems: "center", justifyContent: "center", gap: 14 },
});
