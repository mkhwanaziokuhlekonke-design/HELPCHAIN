import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DonationAuditTimeline } from "@/components/DonationAuditTimeline";
import { useCommunityCentres } from "@/context/CommunityCentreContext";
import { AvailableDonationItem, Donation, useDonations } from "@/context/DonationContext";

const BLUE = "#2563EB";
const TEAL = "#0D9488";
const PHOTO_LIMIT = 700_000;

function donationStatusLabel(status: string): string {
  return status.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") {
    Alert.alert("Permission required", "Allow access to your photo library to attach proof.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    quality: 0.35,
    base64: true,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  if (!asset.base64 || asset.base64.length > PHOTO_LIMIT) {
    Alert.alert("Photo too large", "Choose a smaller photo or crop it before attaching.");
    return null;
  }
  return `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
}

export function DonationManagementPanel({
  donations,
  selectedDonation,
  onSelectDonation,
}: {
  donations: Donation[];
  selectedDonation: Donation | undefined;
  onSelectDonation: (id: string) => void;
}) {
  const {
    availableItems,
    itemRequests,
    createAvailableItem,
    decideItemRequest,
    confirmDonationReceipt,
    recordDonationDistribution,
    investigateDonation,
    resolveDonationInvestigation,
  } = useDonations();
  const { centres } = useCommunityCentres();
  const [description, setDescription] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Household essentials");
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [collectionHours, setCollectionHours] = useState("24");
  const [inventoryPhoto, setInventoryPhoto] = useState<string | null>(null);
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [requestCollectionHours, setRequestCollectionHours] = useState<Record<string, string>>({});
  const [distributionQuantity, setDistributionQuantity] = useState("");
  const [beneficiaryCategory, setBeneficiaryCategory] = useState("household");
  const [distributionPhoto, setDistributionPhoto] = useState<string | null>(null);
  const [investigationReason, setInvestigationReason] = useState("");
  const [investigationResolution, setInvestigationResolution] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItemName(selectedDonation?.itemType ?? "");
    setReceivedQuantity(selectedDonation ? String(selectedDonation.quantity) : "");
    setReceiptPhoto(null);
  }, [selectedDonation?.id]);

  const counts = useMemo(() => {
    const statuses = ["pending-delivery", "delivered", "received-verified", "distributed", "completed", "investigation"];
    return statuses.map((status) => ({
      status,
      count: donations.filter((donation) =>
        status === "pending-delivery"
          ? donation.status === status || donation.status === "registered"
          : donation.status === status
      ).length,
    }));
  }, [donations]);

  const receivedRemaining = selectedDonation
    ? (selectedDonation.quantityReceived ?? 0)
      - (selectedDonation.inventoryListedQuantity ?? 0)
      - (selectedDonation.distributedQuantity ?? 0)
    : 0;

  async function handleCreateAvailableItem() {
    if (!selectedDonation?.donationId || !itemName.trim() || !description.trim() || !category.trim()
      || !/^\d+$/.test(inventoryQuantity) || !/^\d+$/.test(collectionHours)) {
      Alert.alert("Details required", "Select a verified donation and complete the item, quantity, category, and collection deadline.");
      return;
    }
    setBusy(true);
    try {
      await createAvailableItem({
        donationId: selectedDonation.id,
        itemName: itemName.trim(),
        description: description.trim(),
        category: category.trim(),
        quantity: Number(inventoryQuantity),
        photo: inventoryPhoto ?? undefined,
        collectionHours: Number(collectionHours),
      });
      setDescription("");
      setInventoryQuantity("1");
      setInventoryPhoto(null);
      Alert.alert("Item available", "Verified donated items are now visible in Available Donations.");
    } catch (error) {
      Alert.alert("Could not list item", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(requestId: string, decision: "approved" | "rejected") {
    const hours = Number(requestCollectionHours[requestId] ?? "24");
    if (decision === "approved" && (!Number.isSafeInteger(hours) || hours < 1 || hours > 168)) {
      Alert.alert("Invalid collection deadline", "Enter a collection period from 1 to 168 hours.");
      return;
    }
    setBusy(true);
    try {
      await decideItemRequest(requestId, decision, decision === "approved" ? hours : undefined);
    } catch (error) {
      Alert.alert("Request not updated", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyReceipt() {
    const quantity = Number(receivedQuantity);
    if (!selectedDonation || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > selectedDonation.quantity) {
      Alert.alert("Invalid received quantity", `Enter the number of items physically received, from 1 to ${selectedDonation?.quantity ?? 0}.`);
      return;
    }
    setBusy(true);
    try {
      await confirmDonationReceipt(selectedDonation.id, quantity, receiptPhoto ?? undefined);
      Alert.alert("Receipt verified", "The physical receipt and verification date have been recorded.");
    } catch (error) {
      Alert.alert("Could not verify receipt", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDistribution() {
    if (!selectedDonation || !distributionPhoto || !/^\d+$/.test(distributionQuantity)) {
      Alert.alert("Distribution proof required", "Enter a quantity and attach a photo of the distribution record or items.");
      return;
    }
    setBusy(true);
    try {
      await recordDonationDistribution(
        selectedDonation.id,
        selectedDonation.itemType,
        Number(distributionQuantity),
        beneficiaryCategory,
        distributionPhoto
      );
      setDistributionQuantity("");
      setDistributionPhoto(null);
      Alert.alert("Distribution recorded", "This distribution has been added to the permanent audit history.");
    } catch (error) {
      Alert.alert("Distribution not recorded", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateInvestigation(resolve: boolean) {
    if (!selectedDonation) return;
    const note = resolve ? investigationResolution.trim() : investigationReason.trim();
    if (!note) {
      Alert.alert("Details required", resolve ? "Describe the investigation outcome." : "Describe why this donation needs investigation.");
      return;
    }
    setBusy(true);
    try {
      if (resolve) {
        await resolveDonationInvestigation(selectedDonation.id, note);
        setInvestigationResolution("");
      } else {
        await investigateDonation(selectedDonation.id, note);
        setInvestigationReason("");
      }
    } catch (error) {
      Alert.alert("Investigation not updated", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Donation accountability</Text>
      <Text style={styles.subheading}>Live donation totals, verified inventory, collection requests and permanent audit records.</Text>

      <View style={styles.statusGrid}>
        {counts.map(({ status, count }) => (
          <View key={status} style={styles.statusTile}>
            <Text style={styles.statusCount}>{count}</Text>
            <Text style={styles.statusName}>{donationStatusLabel(status)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All donations</Text>
        {donations.length === 0 ? <Text style={styles.muted}>No donations have been registered.</Text> : donations.map((donation) => (
          <Pressable key={donation.id} onPress={() => onSelectDonation(donation.id)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.primary}>{donation.donationId ?? donation.id}</Text>
              <Text style={styles.muted}>{donation.quantity} × {donation.itemType} · {donation.destination?.name ?? "Centre unavailable"}</Text>
            </View>
            <Text style={[styles.badge, { color: donation.status === "investigation" ? "#B91C1C" : TEAL }]}>
              {donationStatusLabel(donation.status)}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedDonation && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected: {selectedDonation.donationId ?? selectedDonation.id}</Text>
          <Text style={styles.muted}>{selectedDonation.donorName} · {selectedDonation.quantity} × {selectedDonation.itemType}</Text>
          {selectedDonation.donorEmail ? <Text style={styles.muted}>Donor email: {selectedDonation.donorEmail}</Text> : null}
          <Text style={styles.muted}>Status: {donationStatusLabel(selectedDonation.status)}</Text>
          {["pending-delivery", "delivered", "registered"].includes(selectedDonation.status) && (
            <>
              <Text style={styles.sectionTitle}>Verify physical receipt</Text>
              <Text style={styles.muted}>Confirm only after the items arrive at the receiving centre. Verification records the current date and cannot exceed the donated quantity.</Text>
              <TextInput
                value={receivedQuantity}
                onChangeText={setReceivedQuantity}
                placeholder={`Quantity received (up to ${selectedDonation.quantity})`}
                keyboardType="number-pad"
                style={styles.input}
              />
              {receiptPhoto ? <Image source={{ uri: receiptPhoto }} style={styles.proof} resizeMode="cover" /> : null}
              <Pressable onPress={async () => setReceiptPhoto(await pickPhoto())} style={styles.outlineButton}>
                <Feather name="camera" size={15} color={BLUE} />
                <Text style={styles.outlineText}>{receiptPhoto ? "Change receipt proof" : "Attach receipt proof (optional)"}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={handleVerifyReceipt} style={[styles.actionButton, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionText}>Verify physical receipt</Text>}
              </Pressable>
            </>
          )}
          {selectedDonation.receivedAt && (
            <>
              <Text style={styles.sectionTitle}>Proof of Receipt</Text>
              <Text style={styles.muted}>
                {selectedDonation.quantityReceived ?? selectedDonation.quantity} × {selectedDonation.itemType} received at {selectedDonation.receivedCentreName ?? selectedDonation.destination?.name ?? "centre"} on {new Date(selectedDonation.receivedAt).toLocaleString()} by {selectedDonation.receivedByName ?? "authorized centre staff"}
              </Text>
              {selectedDonation.proofPhoto && <Image source={{ uri: selectedDonation.proofPhoto }} style={styles.proof} resizeMode="cover" />}
            </>
          )}
          {selectedDonation.status === "investigation" ? (
            <>
              <Text style={styles.sectionTitle}>Resolve donation investigation</Text>
              <Text style={styles.muted}>Reason: {selectedDonation.investigation?.reason ?? "No reason provided"}</Text>
              <TextInput value={investigationResolution} onChangeText={setInvestigationResolution} placeholder="Investigation outcome" multiline style={[styles.input, { minHeight: 60 }]} />
              <Pressable disabled={busy} onPress={() => updateInvestigation(true)} style={[styles.actionButton, busy && styles.disabled]}>
                <Text style={styles.actionText}>Resolve and restore prior status</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Flag for investigation</Text>
              <TextInput value={investigationReason} onChangeText={setInvestigationReason} placeholder="Reason for review" multiline style={[styles.input, { minHeight: 60 }]} />
              <Pressable disabled={busy} onPress={() => updateInvestigation(false)} style={[styles.actionButton, { backgroundColor: "#B91C1C" }, busy && styles.disabled]}>
                <Text style={styles.actionText}>Place donation under investigation</Text>
              </Pressable>
            </>
          )}
          <Text style={styles.sectionTitle}>Immutable audit history</Text>
          <DonationAuditTimeline parentId={selectedDonation.id} />

          {selectedDonation.status === "received-verified" || selectedDonation.status === "distributed" ? (
            <>
              <Text style={styles.sectionTitle}>List verified goods for collection</Text>
              <Text style={styles.muted}>Unlisted verified quantity: {Math.max(0, receivedRemaining)}</Text>
              {centres.find((centre) => centre.id === selectedDonation.receivedCentreId)?.name
                ? <Text style={styles.muted}>Receiving centre: {selectedDonation.receivedCentreName}</Text>
                : <Text style={styles.muted}>Receiving centre: {selectedDonation.receivedCentreName ?? selectedDonation.destination?.name ?? "Unavailable"}</Text>}
              <TextInput value={category} onChangeText={setCategory} placeholder="Category" style={styles.input} />
              <TextInput value={itemName} onChangeText={setItemName} placeholder="Available item name" style={styles.input} />
              <TextInput value={description} onChangeText={setDescription} placeholder="Item description" multiline style={[styles.input, { minHeight: 70 }]} />
              <TextInput value={inventoryQuantity} onChangeText={setInventoryQuantity} placeholder="Available quantity" keyboardType="number-pad" style={styles.input} />
              <TextInput value={collectionHours} onChangeText={setCollectionHours} placeholder="Collection period in hours (1–168)" keyboardType="number-pad" style={styles.input} />
              <Pressable onPress={async () => setInventoryPhoto(await pickPhoto())} style={styles.outlineButton}>
                <Feather name="image" size={15} color={BLUE} />
                <Text style={styles.outlineText}>{inventoryPhoto ? "Change item photo" : "Add item photo"}</Text>
              </Pressable>
              <Pressable disabled={busy || receivedRemaining <= 0} onPress={handleCreateAvailableItem} style={[styles.actionButton, (busy || receivedRemaining <= 0) && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionText}>Make available at receiving centre</Text>}
              </Pressable>

              <Text style={styles.sectionTitle}>Record distribution</Text>
              <Text style={styles.muted}>Distribution requires proof and cannot exceed verified, unlisted items.</Text>
              <TextInput value={distributionQuantity} onChangeText={setDistributionQuantity} placeholder="Quantity distributed" keyboardType="number-pad" style={styles.input} />
              <TextInput value={beneficiaryCategory} onChangeText={setBeneficiaryCategory} placeholder="Beneficiary category (household, family, community-group, shelter, other)" style={styles.input} />
              <Pressable onPress={async () => setDistributionPhoto(await pickPhoto())} style={styles.outlineButton}>
                <Feather name="camera" size={15} color={BLUE} />
                <Text style={styles.outlineText}>{distributionPhoto ? "Change distribution proof" : "Attach distribution proof"}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={handleDistribution} style={[styles.actionButton, busy && styles.disabled]}>
                <Text style={styles.actionText}>Record accountable distribution</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Available inventory · {availableItems.length}</Text>
        {availableItems.map((item: AvailableDonationItem) => (
          <View key={item.id} style={styles.inventoryRow}>
            {item.photo ? <Image source={{ uri: item.photo }} style={styles.thumb} /> : <Feather name="gift" size={22} color={TEAL} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.primary}>{item.itemName}</Text>
              <Text style={styles.muted}>{item.quantityAvailable} available · {item.quantityReserved} reserved · {item.communityCentre}</Text>
              <Text style={styles.muted}>Added {new Date(item.createdAt).toLocaleString()}</Text>
              <Text style={styles.muted}>Collection by {new Date(item.collectionDeadline).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Item requests · {itemRequests.length}</Text>
        {itemRequests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <Text style={styles.primary}>{request.requestId} · {request.itemName} × {request.quantity}</Text>
            <Text style={styles.muted}>{request.userName} · {request.communityCentre} · {donationStatusLabel(request.status)}</Text>
            {request.reservationExpiresAt && <Text style={styles.muted}>Collect by {new Date(request.reservationExpiresAt).toLocaleString()}</Text>}
            <DonationAuditTimeline parentId={request.id} request />
            {request.status === "pending" && (
              <>
                <TextInput
                  value={requestCollectionHours[request.id] ?? "24"}
                  onChangeText={(value) => setRequestCollectionHours((current) => ({ ...current, [request.id]: value }))}
                  placeholder="Collection deadline after approval (hours, 1–168)"
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <View style={styles.buttonRow}>
                  <Pressable disabled={busy} onPress={() => handleDecision(request.id, "approved")} style={styles.actionButton}>
                    <Text style={styles.actionText}>Approve with deadline</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => handleDecision(request.id, "rejected")} style={[styles.actionButton, { backgroundColor: "#B91C1C" }]}>
                    <Text style={styles.actionText}>Reject</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 14, gap: 12 },
  heading: { color: "#0F2747", fontSize: 20, fontFamily: "Inter_700Bold" },
  subheading: { color: "#64748B", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusTile: { width: "31%", minWidth: 94, flexGrow: 1, padding: 11, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DBEAFE", gap: 3 },
  statusCount: { color: BLUE, fontSize: 19, fontFamily: "Inter_700Bold" },
  statusName: { color: "#64748B", fontSize: 10, fontFamily: "Inter_500Medium" },
  card: { padding: 14, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DBEAFE", gap: 9 },
  cardTitle: { color: "#0F2747", fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionTitle: { color: "#0F2747", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#EFF6FF" },
  primary: { color: "#1E3A5F", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  muted: { color: "#64748B", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  badge: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderColor: "#DBEAFE", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, color: "#1E3A5F", backgroundColor: "#F8FAFC", fontSize: 12 },
  outlineButton: { minHeight: 39, borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 9, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  outlineText: { color: BLUE, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 9, flex: 1, backgroundColor: TEAL, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#FFFFFF", fontSize: 11, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.55 },
  proof: { width: "100%", height: 180, borderRadius: 10, backgroundColor: "#EFF6FF" },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#EFF6FF" },
  inventoryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#EFF6FF" },
  requestCard: { borderTopWidth: 1, borderTopColor: "#EFF6FF", paddingTop: 9, gap: 6 },
  buttonRow: { flexDirection: "row", gap: 8 },
});
