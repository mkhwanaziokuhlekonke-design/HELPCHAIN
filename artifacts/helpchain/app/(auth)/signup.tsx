import { LinearGradient } from "expo-linear-gradient";
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
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
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
  if (passed === 2) return { score: passed, label: "Weak", color: "#F97316" };
  if (passed === 3) return { score: passed, label: "Fair", color: "#EAB308" };
  if (passed === 4) return { score: passed, label: "Strong", color: "#22C55E" };
  return { score: passed, label: "Very Strong", color: "#14B8A6" };
}

function isPasswordStrong(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

export default function SignupScreen() {
  const colors = useColors();
  const { signup } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const strength = passwordStrength(password);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password.trim()) {
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
    const result = await signup(name.trim(), email.trim(), password);
    setLoading(false);
    if (result.ok) {
      router.replace("/(auth)/location" as any);
    } else {
      Alert.alert("Sign Up Failed", result.error ?? "Could not create account. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#1F2937", "#14B8A6"]}
        style={[styles.header, { paddingTop: topPad + 20 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>HelpChain</Text>
        </View>
        <Text style={styles.headerSub}>Join your community today</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Create Account</Text>

        {[
          { label: "Full Name", icon: "user", value: name, setter: setName, placeholder: "Your full name", keyboard: "default" as const },
          { label: "Email", icon: "mail", value: email, setter: setEmail, placeholder: "you@example.com", keyboard: "email-address" as const },
        ].map((field) => (
          <View key={field.label} style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{field.label}</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name={field.icon as any} size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder={field.placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={field.value}
                onChangeText={field.setter}
                keyboardType={field.keyboard}
                autoCapitalize={field.label === "Email" ? "none" : "words"}
                autoCorrect={false}
              />
            </View>
          </View>
        ))}

        {/* Password with strength meter */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Create a strong password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={(t) => { setPassword(t); setShowRules(true); }}
              secureTextEntry={!showPass}
            />
            <Pressable onPress={() => setShowPass(!showPass)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {password.length > 0 && (
            <View style={styles.strengthRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[styles.strengthBar, { backgroundColor: i <= strength.score ? strength.color : colors.border }]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          {showRules && password.length > 0 && (
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
          onPress={handleSignup}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.switchLink, { color: colors.primary }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 32, gap: 8 },
  backBtn: { marginBottom: 8, alignSelf: "flex-start" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  form: { padding: 24, gap: 14 },
  sectionTitle: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 4, minWidth: 70 },
  rulesBox: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 6 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  ruleText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  button: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
