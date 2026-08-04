import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo.jpeg");

export default function AdminLoginScreen() {
  const colors = useColors();
  const { login, allUsers } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleAdminLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your admin credentials.");
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.ok) {
      // Check isAdmin from the Firestore profile (loaded into allUsers via onSnapshot)
      const loggedIn = allUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (loggedIn && !loggedIn.isAdmin) {
        Alert.alert(
          "Access Denied",
          "This portal is for admins only. Please use the User portal instead."
        );
        return;
      }
      router.replace("/(tabs)" as any);
    } else {
      Alert.alert("Access Denied", result.error ?? "Invalid admin credentials.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#0F172A", "#0F766E", "#14B8A6"]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
        </Pressable>

        <View style={styles.headerContent}>
          <View style={styles.logoWrap}>
            <Image source={logo} style={styles.logoImage} resizeMode="contain" />
            <View style={styles.lockBadge}>
              <Feather name="lock" size={12} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.headerTitle}>Admin Portal</Text>
          <Text style={styles.headerSub}>Restricted access — authorised personnel only</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.warningBanner, { backgroundColor: "#FFF7ED", borderColor: "#F59E0B" }]}>
          <Feather name="alert-triangle" size={16} color="#D97706" />
          <Text style={[styles.warningText, { color: "#92400E" }]}>
            This is a restricted admin portal. Only authorised admins may sign in here.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Admin Sign In</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Admin Email</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="admin@helpchain.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <Pressable onPress={() => setShowPass(!showPass)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={handleAdminLogin}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: "#0F766E", opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="shield" size={18} color="#fff" />
              <Text style={styles.buttonText}>Sign In as Admin</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
            Back to portal
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerContent: {
    alignItems: "center",
    gap: 10,
  },
  logoWrap: {
    position: "relative",
    width: 100,
    height: 100,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  lockBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  form: {
    padding: 24,
    gap: 16,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  demoHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  button: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
