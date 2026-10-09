import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { useDonations } from "@/context/DonationContext";
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

/* ── Profile menu item ── */
function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#F8FAFC" : colors.primary + "18" }]}>
        <Feather name={icon} size={17} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      <Text style={{ fontSize: 16, color: colors.mutedForeground }}>›</Text>
    </Pressable>
  );
}

/* ── Edit Profile Modal ── */
function EditProfileModal({
  visible,
  initialName,
  initialPhone,
  initialEmail,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialName: string;
  initialPhone: string;
  initialEmail: string;
  onSave: (name: string, phone: string, email: string, password?: string) => Promise<void>;
  onClose: () => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const emailChanged = email.trim().toLowerCase() !== initialEmail.toLowerCase();

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhone(initialPhone);
      setEmail(initialEmail);
      setPassword("");
    }
  }, [visible, initialName, initialPhone, initialEmail]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    if (emailChanged && !password) {
      Alert.alert("Password required", "Enter your current password to confirm the email change.");
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), phone.trim(), email.trim(), password || undefined);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save changes. Please try again.";
      Alert.alert("Could not update profile", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={edit.overlay}>
        <View style={[edit.sheet, { backgroundColor: colors.card }]}>
          <View style={edit.handle} />

          <Text style={[edit.title, { color: colors.foreground }]}>Edit Profile</Text>
          <Text style={[edit.sub, { color: colors.mutedForeground }]}>
            Update your name, phone number, or email
          </Text>

          {/* Name */}
          <Text style={[edit.label, { color: colors.foreground }]}>Full Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            style={[edit.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          {/* Phone */}
          <Text style={[edit.label, { color: colors.foreground }]}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. +1 555 000 0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[edit.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          <Text style={[edit.label, { color: colors.foreground }]}>Email Address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={[edit.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          {emailChanged && (
            <>
              <Text style={[edit.label, { color: colors.foreground }]}>Current Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Confirm your current password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoComplete="current-password"
                style={[edit.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              />
            </>
          )}

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[edit.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={edit.saveBtnText}>Save Changes</Text>
            }
          </Pressable>

          <Pressable onPress={onClose} style={edit.cancelBtn}>
            <Text style={[edit.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ── Main Profile Screen ── */
export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout, updateProfilePhoto, updateProfileName } = useAuth();
  const { donations, loading: donationsLoading, error: donationsError } = useDonations();
  const { requests } = useHelp();
  const userDonations = donations.filter((donation) => donation.donorId === user?.id);
  const userEmergencyRequests = requests
    .filter((request) => request.requesterId === user?.id && request.isEmergency)
    .slice(0, 3);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [donationsVisible, setDonationsVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  async function handlePickPhoto() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Please allow access to your photo library in Settings to set a profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Error", "Could not read image data. Please try another photo.");
        return;
      }
      if (asset.base64.length > 700_000) {
        Alert.alert("Photo too large", "Please choose a smaller image or crop it more tightly.");
        return;
      }

      setUploadingPhoto(true);
      await updateProfilePhoto(`data:image/jpeg;base64,${asset.base64}`);
    } catch (e: any) {
      Alert.alert("Error", "Could not update profile photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function confirmLogout() {
    try {
      await logout();
      router.replace("/(auth)/portal" as any);
    } catch {
      Alert.alert("Sign Out Failed", "Could not sign out. Please try again.");
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <LinearGradient colors={["#0F2747", "#2563EB"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
        {/* Avatar */}
        <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.avatarWrap}>
          <UserAvatar name={user.name} size={86} isAdmin={user.isAdmin} photoURL={user.photoURL} />
          <View style={styles.cameraBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Feather name="camera" size={14} color="#FFFFFF" />
            }
          </View>
        </Pressable>

        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        {user.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}

        {user.isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={{ fontSize: 12 }}>🛡️</Text>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}

        {/* Edit profile button */}
        <Pressable
          onPress={() => setEditVisible(true)}
          style={styles.editBtn}
        >
          <Text style={{ fontSize: 13 }}>✏️</Text>
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </Pressable>

        <Text style={styles.photoHint}>Tap photo to change picture</Text>
      </LinearGradient>

      {/* ── Body ── */}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Menu */}
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          {user.isAdmin && (
            <MenuItem icon="grid" label="Admin Dashboard" onPress={() => router.push("/admin" as any)} />
          )}
          <MenuItem icon="edit-3" label="Edit Profile" onPress={() => setEditVisible(true)} />
          <MenuItem icon="camera" label="Change Profile Photo" onPress={handlePickPhoto} />
          {user.isAdmin && (
            <MenuItem icon="message-circle" label="Community Chat" onPress={() => router.push("/(tabs)/chat" as any)} />
          )}
          <MenuItem icon="map-pin" label="Update Location" onPress={() => router.push("/(auth)/location" as any)} />
          <MenuItem
            icon="gift"
            label="Items Donated"
            onPress={() => setDonationsVisible((visible) => !visible)}
          />
        </View>

        {donationsVisible && (
          <View style={[styles.donationsGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.donationsTitle, { color: colors.foreground }]}>Items You Donated</Text>
            {donationsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : donationsError ? (
              <Text accessibilityRole="alert" style={[styles.donationsEmpty, { color: colors.destructive }]}>{donationsError}</Text>
            ) : userDonations.length === 0 ? (
              <Text style={[styles.donationsEmpty, { color: colors.mutedForeground }]}>Your donated items will appear here.</Text>
            ) : userDonations.map((donation) => (
              <View key={donation.id} style={[styles.donationRow, { borderTopColor: colors.border }]}>
                <View style={[styles.donationIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="gift" size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.donationItem, { color: colors.foreground }]}>{donation.itemType}</Text>
                  <Text style={[styles.donationsEmpty, { color: colors.mutedForeground }]}>
                    {donation.destination?.name ?? "Centre unavailable"} · {donation.status}
                  </Text>
                  <Text style={[styles.donationsEmpty, { color: colors.mutedForeground }]}>
                    {new Date(donation.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.requestGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.requestGroupHeading}>
            <View style={[styles.requestGroupIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="alert-triangle" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.donationsTitle, { color: colors.foreground }]}>My emergency requests</Text>
              <Text style={[styles.donationsEmpty, { color: colors.mutedForeground }]}>Track your recent requests</Text>
            </View>
          </View>
          {userEmergencyRequests.length ? userEmergencyRequests.map((request) => {
            const statusLabel = request.status === "open"
              ? "Pending"
              : request.status === "accepted"
                ? "In Progress"
                : request.status === "completed"
                  ? "Resolved"
                  : "Cancelled";
            const statusColor = request.status === "completed"
              ? colors.darkTeal
              : request.status === "accepted"
                ? colors.primary
                : request.status === "cancelled"
                  ? colors.mutedForeground
                  : "#F59E0B";
            return (
              <Pressable
                key={request.id}
                onPress={() => router.push(`/request/${request.id}` as any)}
                accessibilityRole="button"
                style={[styles.requestRow, { borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.donationItem, { color: colors.foreground }]} numberOfLines={1}>{request.title}</Text>
                  <Text style={[styles.donationsEmpty, { color: colors.mutedForeground }]}>{request.category}</Text>
                </View>
                <View style={[styles.requestBadge, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.requestBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          }) : (
            <Text style={[styles.donationsEmpty, { color: colors.mutedForeground }]}>Emergency requests you create will appear here.</Text>
          )}
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutBtn, { borderColor: colors.destructive + "60", opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <EditProfileModal
        visible={editVisible}
        initialName={user.name}
        initialPhone={user.phone ?? ""}
        initialEmail={user.email}
        onSave={updateProfileName}
        onClose={() => setEditVisible(false)}
      />
    </View>
  );
}

/* ── styles ── */
const styles = StyleSheet.create({
  headerGrad: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: "center",
    gap: 6,
  },
  avatarWrap: {
    position: "relative",
    marginTop: 8,
    marginBottom: 4,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#0F2747",
    alignItems: "center",
    justifyContent: "center",
  },
  photoHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  userName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  userEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  userPhone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(20,184,166,0.25)",
  },
  adminBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#14B8A6",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 2,
  },
  editBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  requestGroup: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10, shadowColor: "#0B1F3A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  requestGroupHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  requestGroupIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  requestRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  requestBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  requestBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  donationsGroup: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  donationsTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  donationsEmpty: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  donationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  donationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  donationItem: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  menuGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});

/* ── edit modal styles ── */
const edit = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DBEAFE",
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: -4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
