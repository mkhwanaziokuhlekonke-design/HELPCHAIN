import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

function MenuItem({ icon, label, onPress, color, danger }: {
  icon: string; label: string; onPress: () => void; color?: string; danger?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1, borderBottomColor: colors.border }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: (danger ? colors.destructive : (color ?? colors.primary)) + "18" }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : (color ?? colors.primary)} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout, updateProfilePhoto } = useAuth();
  const { requests } = useHelp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  const myRequests = requests.filter((r) => r.requesterId === user?.id);
  const helpedCount = requests.filter((r) => r.helperId === user?.id).length;
  const completedCount = myRequests.filter((r) => r.status === "completed").length;

  async function handlePickPhoto() {
    try {
      // Request permission
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

      // Check size — base64 string ~33% larger than raw bytes; cap at 700KB
      if (asset.base64.length > 700_000) {
        Alert.alert("Photo too large", "Please choose a smaller image or crop it more tightly.");
        return;
      }

      setUploadingPhoto(true);
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      await updateProfilePhoto(dataUri);
    } catch (e: any) {
      Alert.alert("Error", "Could not update profile photo. Please try again.");
      console.error("pickPhoto error", e);
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
      <LinearGradient colors={["#1F2937", "#2563EB"]} style={[styles.headerGrad, { paddingTop: topPad }]}>

        {/* Avatar with camera overlay */}
        <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.avatarWrap}>
          <UserAvatar name={user.name} size={86} isAdmin={user.isAdmin} photoURL={user.photoURL} />
          {/* Camera badge */}
          <View style={styles.cameraBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="camera" size={14} color="#fff" />
            }
          </View>
        </Pressable>

        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        {user.isAdmin && (
          <View style={[styles.adminBadge, { backgroundColor: "rgba(20,184,166,0.25)" }]}>
            <Feather name="shield" size={12} color="#14B8A6" />
            <Text style={[styles.adminBadgeText, { color: "#14B8A6" }]}>Admin</Text>
          </View>
        )}

        {/* Tap hint */}
        <Text style={styles.photoHint}>Tap photo to change</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats row */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Requests", value: myRequests.length },
            { label: "Helped", value: helpedCount },
            { label: "Completed", value: completedCount },
          ].map((s, i) => (
            <View key={s.label} style={[styles.statItem, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          {user.isAdmin && (
            <MenuItem icon="settings" label="Admin Dashboard" onPress={() => router.push("/admin" as any)} color={colors.accent} />
          )}
          <MenuItem icon="camera" label="Change Profile Photo" onPress={handlePickPhoto} color={colors.primary} />
          <MenuItem icon="list" label="My Requests" onPress={() => router.push("/(tabs)/requests" as any)} />
          <MenuItem icon="message-circle" label="Community Chat" onPress={() => router.push("/(tabs)/chat" as any)} color={colors.accent} />
          <MenuItem icon="bell" label="Notifications" onPress={() => router.push("/(tabs)/notifications" as any)} />
          <MenuItem icon="map-pin" label="Update Location" onPress={() => router.push("/(auth)/location" as any)} />
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutBtn, { borderColor: colors.destructive + "60", opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGrad: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: "center",
    gap: 8,
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
    marginTop: -4,
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
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  adminBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
    gap: 4,
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
