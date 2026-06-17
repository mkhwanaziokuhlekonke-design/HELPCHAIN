import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { HelpCategory, useHelp } from "@/context/HelpContext";
import { useNotifications } from "@/context/NotificationContext";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: { key: HelpCategory; label: string; icon: string }[] = [
  { key: "emergency", label: "Emergency", icon: "alert-triangle" },
  { key: "medical", label: "Medical", icon: "heart" },
  { key: "food", label: "Food", icon: "shopping-bag" },
  { key: "transport", label: "Transport", icon: "truck" },
  { key: "daily", label: "Daily Task", icon: "tool" },
  { key: "other", label: "Other", icon: "help-circle" },
];

export default function NewRequestScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { addRequest } = useHelp();
  const { addNotification } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HelpCategory>("daily");
  const [isEmergency, setIsEmergency] = useState(false);
  const [useLocation, setUseLocation] = useState(false);
  const [locationData, setLocationData] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  async function handleToggleLocation(val: boolean) {
    setUseLocation(val);
    if (!val) { setLocationData(null); return; }
    setLoadingLocation(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const [geocode] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          const address = geocode ? [geocode.street, geocode.city].filter(Boolean).join(", ") : undefined;
          setLocationData({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, address });
        } else {
          Alert.alert("Permission Denied", "Location access is required to share your location.");
          setUseLocation(false);
        }
      } else {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocationData({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, address: "Your current location" });
            },
            () => {
              Alert.alert("Location Error", "Could not get your location.");
              setUseLocation(false);
            }
          );
        }
      }
    } catch {
      Alert.alert("Location Error", "Could not get your location.");
      setUseLocation(false);
    } finally {
      setLoadingLocation(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) { Alert.alert("Error", "Please enter a title."); return; }
    if (!description.trim()) { Alert.alert("Error", "Please add a description."); return; }
    if (!user) { Alert.alert("Error", "You must be logged in."); return; }

    setSubmitting(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const req = await addRequest({
      title: title.trim(),
      description: description.trim(),
      category: isEmergency ? "emergency" : category,
      isEmergency,
      requesterId: user.id,
      requesterName: user.name,
      location: locationData ?? undefined,
    });

    if (isEmergency) {
      await addNotification({
        title: "Emergency Alert",
        body: `${user.name} posted an emergency request: ${title}`,
        type: "emergency_alert",
        requestId: req.id,
      });
    }

    setSubmitting(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#1F2937", "#2563EB"]} style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>New Help Request</Text>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.emergencyRow, { backgroundColor: isEmergency ? "#FEF2F2" : colors.secondary, borderColor: isEmergency ? colors.destructive : colors.border }]}>
          <View style={styles.emergencyLeft}>
            <View style={[styles.emergencyIcon, { backgroundColor: isEmergency ? colors.destructive : colors.muted }]}>
              <Feather name="alert-triangle" size={18} color={isEmergency ? "#fff" : colors.mutedForeground} />
            </View>
            <View>
              <Text style={[styles.emergencyLabel, { color: isEmergency ? colors.destructive : colors.foreground }]}>Emergency</Text>
              <Text style={[styles.emergencyHint, { color: colors.mutedForeground }]}>Urgent help needed immediately</Text>
            </View>
          </View>
          <Switch
            value={isEmergency}
            onValueChange={(v) => {
              setIsEmergency(v);
              if (v) setCategory("emergency");
            }}
            trackColor={{ true: colors.destructive, false: colors.muted }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Title *</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Briefly describe what you need"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description *</Text>
          <View style={[styles.textareaWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.textarea, { color: colors.foreground }]}
              placeholder="Give details about your request — what's needed, when, where..."
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>
        </View>

        {!isEmergency && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.filter((c) => c.key !== "emergency").map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={[
                    styles.categoryChip,
                    {
                      borderColor: category === cat.key ? colors.primary : colors.border,
                      backgroundColor: category === cat.key ? colors.secondary : colors.card,
                    },
                  ]}
                >
                  <Feather name={cat.icon as any} size={15} color={category === cat.key ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.categoryText, { color: category === cat.key ? colors.primary : colors.mutedForeground }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.locationRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.locationLeft}>
            <Feather name="map-pin" size={18} color={useLocation ? colors.primary : colors.mutedForeground} />
            <View>
              <Text style={[styles.locationLabel, { color: colors.foreground }]}>Share My Location</Text>
              {locationData?.address && (
                <Text style={[styles.locationAddress, { color: colors.primary }]} numberOfLines={1}>{locationData.address}</Text>
              )}
            </View>
            {loadingLocation && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <Switch
            value={useLocation}
            onValueChange={handleToggleLocation}
            trackColor={{ true: colors.primary, false: colors.muted }}
            thumbColor="#fff"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: isEmergency ? colors.destructive : colors.primary, opacity: pressed || submitting ? 0.85 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={isEmergency ? "alert-triangle" : "send"} size={18} color="#fff" />
              <Text style={styles.submitText}>{isEmergency ? "Post Emergency Request" : "Post Help Request"}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  form: {
    padding: 16,
    gap: 16,
  },
  emergencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  emergencyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emergencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emergencyHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textareaWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 100,
    textAlignVertical: "top",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  locationLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  locationAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    maxWidth: 180,
  },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
