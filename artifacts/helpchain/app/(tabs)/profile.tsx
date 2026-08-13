import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
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
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

/* ── simple emoji menu item (no icon font needed) ── */
function MenuItem({
  emoji,
  label,
  onPress,
  danger,
}: {
  emoji: string;
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
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#FEE2E2" : colors.primary + "18" }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
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
  onSave,
  onClose,
}: {
  visible: boolean;
  initialName: string;
  initialPhone: string;
  onSave: (name: string, phone: string) => Promise<void>;
  onClose: () => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), phone.trim());
      onClose();
    } catch {
      Alert.alert("Error", "Could not save changes. Please try again.");
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
            Update your name and phone number
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

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[edit.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
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
  const { requests } = useHelp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  const myRequests = requests.filter((r) => r.requesterId === user?.id);
  const helpedCount = requests.filter((r) => r.helperId === user?.id).length;
  const completedCount = myRequests.filter((r) => r.status === "completed").length;

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

  function confirmLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/portal" as any);
        },
      },
    ]);
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
      <LinearGradient colors={["#1F2937", "#2563EB"]} style={[styles.headerGrad, { paddingTop: topPad }]}>
        {/* Avatar */}
        <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.avatarWrap}>
          <UserAvatar name={user.name} size={86} isAdmin={user.isAdmin} photoURL={user.photoURL} />
          <View style={styles.cameraBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ fontSize: 13 }}>📷</Text>
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
        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Requests", value: myRequests.length, emoji: "🙋" },
            { label: "Helped", value: helpedCount, emoji: "🤝" },
            { label: "Completed", value: completedCount, emoji: "✅" },
          ].map((s, i) => (
            <View
              key={s.label}
              style={[styles.statItem, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}
            >
              <Text style={{ fontSize: 20, marginBottom: 2 }}>{s.emoji}</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          {user.isAdmin && (
            <MenuItem emoji="⚙️" label="Admin Dashboard" onPress={() => router.push("/admin" as any)} />
          )}
          <MenuItem emoji="✏️" label="Edit Profile" onPress={() => setEditVisible(true)} />
          <MenuItem emoji="📷" label="Change Profile Photo" onPress={handlePickPhoto} />
          <MenuItem emoji="📋" label="My Requests" onPress={() => router.push("/(tabs)/requests" as any)} />
          <MenuItem emoji="💬" label="Community Chat" onPress={() => router.push("/(tabs)/chat" as any)} />
          <MenuItem emoji="🔔" label="Notifications" onPress={() => router.push("/(tabs)/notifications" as any)} />
          <MenuItem emoji="📍" label="Update Location" onPress={() => router.push("/(auth)/location" as any)} />
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutBtn, { borderColor: colors.destructive + "60", opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <EditProfileModal
        visible={editVisible}
        initialName={user.name}
        initialPhone={user.phone ?? ""}
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
    borderColor: "#1F2937",
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
    color: "#fff",
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
    color: "#fff",
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
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
    backgroundColor: "#CBD5E1",
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
    color: "#fff",
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
