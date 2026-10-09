import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { HelpChainLogo } from "@/components/HelpChainLogo";
import { useColors } from "@/hooks/useColors";

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
  if (passed === 2) return { score: passed, label: "Weak", color: "#F59E0B" };
  if (passed === 3) return { score: passed, label: "Fair", color: "#F59E0B" };
  if (passed === 4) return { score: passed, label: "Strong", color: "#10B981" };
  return { score: passed, label: "Very Strong", color: "#14B8A6" };
}

function isPasswordStrong(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

export default function UserLoginScreen() {
  return <AuthLoginScreen />;
}

export function AuthLoginScreen({ adminOnly = false }: { adminOnly?: boolean }) {
  const colors = useColors();
  const { login, signup, resetPassword, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const strength = passwordStrength(password);

  async function handlePasswordReset() {
    setErrorMessage(null);
    setStatusMessage(null);
    if (!email.trim()) {
      setErrorMessage("Enter your email address first, then tap Forgot password.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(email.trim());
      if (result.ok) {
        setStatusMessage("If an account exists for that email, a password reset link has been sent.");
      } else {
        setErrorMessage(result.error ?? "Could not send a password reset email. Please try again.");
      }
    } catch {
      setErrorMessage("Could not send a password reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.ok) {
        if (adminOnly && !result.user?.isAdmin) {
          const diagnostic = `Project: ${result.projectId ?? "unknown"}; profile: ${result.profilePath ?? "users/{uid}"}; role: ${result.adminRoleStatus ?? "unavailable"}.`;
          setErrorMessage(result.adminRoleStatus === "missing"
            ? `Access denied. No profile exists for this signed-in UID. ${diagnostic}`
            : `Access denied. Firestore did not return Boolean isAdmin: true for this signed-in UID. ${diagnostic}`);
          try {
            await logout();
          } catch (error) {
            console.error("[Auth] could not sign out after denied admin login:", error);
            setErrorMessage("Access denied. This account does not have administrator privileges, and sign out failed. Please try again.");
          }
        } else if (!result.user?.emailVerified) {
          router.replace({
            pathname: "/(auth)/verify-email",
            params: { email: email.trim() },
          } as any);
        } else if (adminOnly || result.user?.isAdmin) {
          router.replace("/admin" as any);
        } else {
          router.replace("/(tabs)" as any);
        }
      } else {
        setErrorMessage(result.error ?? "Invalid email or password.");
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    setErrorMessage(null);
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Your passwords do not match. Please check both password fields.");
      return;
    }
    if (!isPasswordStrong(password)) {
      setErrorMessage("Your password must have at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.");
      return;
    }
    setLoading(true);
    try {
      const result = await signup(name.trim(), email.trim(), password);
      if (result.ok || result.verificationPending) {
        router.replace({
          pathname: "/(auth)/verify-email",
          params: {
            email: email.trim(),
            expiresAt: result.expiresAt ? String(result.expiresAt) : "",
            resendAt: result.resendAt ? String(result.resendAt) : "",
            deliveryError: result.error ?? "",
          },
        } as any);
      } else {
        setErrorMessage(result.error ?? "Could not create account. Please try again.");
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F2747" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#0F2747", "#2563EB"]} style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerContent}>
          <HelpChainLogo width={220} height={135} light />
          <Text style={styles.headerTitle}>
            {adminOnly ? "Admin Sign In" : mode === "login" ? "Sign In" : "Create Account"}
          </Text>
          <Text style={styles.headerSub}>
            {adminOnly
              ? "Sign in with an authorized administrator account."
              : "Help together. Grow together."}
          </Text>
        </View>

        {!adminOnly && <View style={styles.modeTabs}>
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
        </View>}
      </LinearGradient>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {errorMessage && (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        )}
        {statusMessage && (
          <Text accessibilityLiveRegion="polite" style={[styles.statusMessage, { color: colors.darkTeal, backgroundColor: colors.secondary }]}>
            {statusMessage}
          </Text>
        )}

        {!adminOnly && mode === "signup" && (
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
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Email Address</Text>
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


        {/* Password field */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {mode === "signup" ? "Create Password" : "Password"}
          </Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={mode === "signup" ? "Create a strong password" : "Your password"}
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (mode === "signup") setShowRules(true);
              }}
              secureTextEntry={!showPass}
            />
            <Pressable onPress={() => setShowPass(!showPass)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Strength meter — signup only */}
          {!adminOnly && mode === "signup" && password.length > 0 && (
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
          {!adminOnly && mode === "signup" && showRules && password.length > 0 && (
            <View style={[styles.rulesBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(password);
                return (
                  <View key={rule.label} style={styles.ruleRow}>
                    <Feather
                      name={passed ? "check-circle" : "circle"}
                      size={13}
                      color={passed ? "#10B981" : colors.mutedForeground}
                    />
                    <Text style={[styles.ruleText, { color: passed ? "#10B981" : colors.mutedForeground }]}>
                      {rule.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {!adminOnly && mode === "signup" && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm Password</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Enter your password again"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
              />
              <Pressable onPress={() => setShowPass(!showPass)} accessibilityRole="button" accessibilityLabel={showPass ? "Hide passwords" : "Show passwords"}>
                <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>
        )}

        {(adminOnly || mode === "login") && (
          <Pressable
            onPress={handlePasswordReset}
            disabled={loading}
            accessibilityRole="button"
            style={styles.forgotPassword}
          >
            <Text style={[styles.switchLink, { color: colors.primary }]}>Forgot password?</Text>
          </Pressable>
        )}

        <Pressable
          onPress={
            adminOnly || mode === "login" ? handleLogin : handleSignup
          }
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {adminOnly
                ? "Sign In as Admin"
                : mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </Pressable>

        {!adminOnly && <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          </Text>
          <Pressable onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setName(""); setEmail(""); setPassword(""); setConfirmPassword(""); setShowRules(false);
          }}>
            <Text style={[styles.switchLink, { color: colors.primary }]}>
              {mode === "login" ? "Sign Up" : "Sign In"}
            </Text>
          </Pressable>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 0 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerContent: { alignItems: "center", gap: 8, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", textAlign: "center" },
  modeTabs: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 4 },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  modeTabActive: { backgroundColor: "#FFFFFF" },
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
  buttonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  errorMessage: { color: "#EF4444", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "Inter_500Medium" },
  statusMessage: { borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "Inter_500Medium" },
  forgotPassword: { alignSelf: "flex-end", paddingVertical: 2 },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
