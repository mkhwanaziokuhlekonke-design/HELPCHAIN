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

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0–9)", test: (p) => /\d/.test(p) },
  { label: "One special character (!@#$…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function passwordStrength(p: string): { score: number; label: string; color: string } {
  const passed = PASSWORD_RULES.filter((r) => r.test(p)).length;
  if (passed <= 1) return { score: passed, label: "Very Weak", color: "#EF4444" };
  if (passed === 2) return { score: passed, label: "Weak", color: "#F97316" };
  if (passed === 3) return { score: passed, label: "Fair", color: "#EAB308" };
  if (passed === 4) return { score: passed, label: "Strong", color: "#22C55E" };
  return { score: passed, label: "Very Strong", color: "#14B8A6" };
}

function isPasswordStrong(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

export default function UserLoginScreen() {
  const colors = useColors();
  const { login, signup, locationGranted } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const strength = passwordStrength(password);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (result.ok) {
      if (!locationGranted) {
        router.replace("/(auth)/location" as any);
      } else {
        router.replace("/(tabs)" as any);
      }
    } else {
      Alert.alert("Login Failed", result.error ?? "Invalid email or password.");
    }
  }

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (!isPasswordStrong(password)) {
      Alert.alert(
        "Weak Password",
        "Your password must have at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character."
      );
      return;
    }
    setLoading(true);
    const result = await signup(name.trim(), email.trim(), phone.trim(), password);
    setLoading(false);
    if (result.ok) {
      router.replace("/(auth)/location" as any);
    } else {
      Alert.alert("Sign Up Failed", result.error ?? "Could not create account. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#1F2937" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#1F2937", "#2563EB"]} style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <View style={styles.headerContent}>
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.headerTitle}>User {mode === "login" ? "Sign In" : "Sign Up"}</Text>
          <Text style={styles.headerSub}>Request help or support your community</Text>
        </View>

        <View style={styles.modeTabs}>
          <Pressable
            onPress={() => setMode("login")}
            style={[styles.modeTab, mode === "login" && styles.modeTabActive]}
          >
            <Text style={[styles.modeTabText, { color: mode === "login" ? "#2563EB" : "rgba(255,255,255,0.7)" }]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("signup")}
            style={[styles.modeTab, mode === "signup" && styles.modeTabActive]}
          >
            <Text style={[styles.modeTabText, { color: mode === "signup" ? "#2563EB" : "rgba(255,255,255,0.7)" }]}>
              Sign Up
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {mode === "signup" && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Full Name</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Your full name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {mode === "signup" && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Phone Number</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="phone" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="+1 555 000 0000"
                placeholderTextColor={colors.mutedForeground}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        )}

        {/* Password field */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={mode === "signup" ? "Create a strong password" : "Your password"}
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={(t) => { setPassword(t); if (mode === "signup") setShowRules(true); }}
              secureTextEntry={!showPass}
            />
            <Pressable onPress={() => setShowPass(!showPass)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Strength meter — signup only */}
          {mode === "signup" && password.length > 0 && (
            <View style={styles.strengthRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    { backgroundColor: i <= strength.score ? strength.color : colors.border },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          {/* Requirements checklist */}
          {mode === "signup" && showRules && password.length > 0 && (
            <View style={[styles.rulesBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(password);
                return (
                  <View key={rule.label} style={styles.ruleRow}>
                    <Feather
                      name={passed ? "check-circle" : "circle"}
                      size={13}
                      color={passed ? "#22C55E" : colors.mutedForeground}
                    />
                    <Text style={[styles.ruleText, { color: passed ? "#22C55E" : colors.mutedForeground }]}>
                      {rule.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Pressable
          onPress={mode === "login" ? handleLogin : handleSignup}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          </Text>
          <Pressable onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setName(""); setEmail(""); setPhone(""); setPassword(""); setShowRules(false);
          }}>
            <Text style={[styles.switchLink, { color: colors.primary }]}>
              {mode === "login" ? "Sign Up" : "Sign In"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 0 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerContent: { alignItems: "center", gap: 8, paddingBottom: 20 },
  logoImage: { width: 100, height: 100, borderRadius: 24, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", textAlign: "center" },
  modeTabs: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 4 },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  modeTabActive: { backgroundColor: "#fff" },
  modeTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  form: { padding: 24, gap: 14 },
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
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 4, minWidth: 70 },
  rulesBox: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 6 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  ruleText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  button: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
