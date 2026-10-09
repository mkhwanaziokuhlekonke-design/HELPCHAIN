import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HelpChainLogo } from "@/components/HelpChainLogo";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function readTimestamp(value: string | string[] | undefined): number | null {
  const timestamp = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function formatCountdown(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  const minutesPart = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

export default function VerifyEmailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    email?: string | string[];
    expiresAt?: string | string[];
    resendAt?: string | string[];
    deliveryError?: string | string[];
  }>();
  const {
    user,
    emailVerificationExpiresAt,
    emailVerificationResendAt,
    resendEmailVerificationOtp,
    verifyEmailOtp,
    logout,
  } = useAuth();
  const verificationServiceConfigured = Boolean(
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim(),
  );
  const emailParam = Array.isArray(params.email)
    ? params.email[0]
    : params.email;
  const deliveryError = Array.isArray(params.deliveryError)
    ? params.deliveryError[0]
    : params.deliveryError;
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(
    () => readTimestamp(params.expiresAt) ?? emailVerificationExpiresAt,
  );
  const [resendAt, setResendAt] = useState(
    () => readTimestamp(params.resendAt) ?? emailVerificationResendAt,
  );
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    deliveryError ||
      (!verificationServiceConfigured
        ? "Email verification is not configured yet. The secure verification service must be deployed before a code can be sent or checked."
        : null),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (emailVerificationExpiresAt) setExpiresAt(emailVerificationExpiresAt);
    if (emailVerificationResendAt) setResendAt(emailVerificationResendAt);
  }, [emailVerificationExpiresAt, emailVerificationResendAt]);

  useEffect(() => {
    if (
      !verificationServiceConfigured ||
      expiresAt !== null ||
      !user ||
      user.emailVerified !== false
    )
      return;
    void handleResend();
  }, [expiresAt, user?.id, user?.emailVerified, verificationServiceConfigured]);

  const remainingMs = expiresAt === null ? null : Math.max(0, expiresAt - now);
  const resendRemainingMs = resendAt === null ? 0 : Math.max(0, resendAt - now);
  const recipient = user?.email || emailParam || "your email address";

  async function handleVerify() {
    setErrorMessage(null);
    setStatusMessage(null);
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("Enter the 6-digit code sent to your email.");
      return;
    }
    if (remainingMs === 0) {
      setErrorMessage("That code has expired. Request a new code to continue.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyEmailOtp(code);
      if (!result.ok) {
        setErrorMessage(
          result.error ?? "That code could not be verified. Please try again.",
        );
        return;
      }
      if (result.user?.isAdmin) {
        router.replace("/admin" as any);
      } else {
        router.replace("/(auth)/location" as any);
      }
    } catch {
      setErrorMessage(
        "We could not verify your code right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!verificationServiceConfigured) {
      setErrorMessage(
        "Email verification is unavailable until the secure verification service is configured.",
      );
      return;
    }
    setErrorMessage(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      const result = await resendEmailVerificationOtp();
      if (result.expiresAt) setExpiresAt(result.expiresAt);
      if (result.resendAt) setResendAt(result.resendAt);
      else if (result.retryAfterSeconds)
        setResendAt(Date.now() + result.retryAfterSeconds * 1000);
      if (result.ok) {
        setCode("");
        setStatusMessage(
          "A new verification code has been sent to your email.",
        );
      } else {
        setErrorMessage(
          result.error ?? "Could not resend the code. Please try again.",
        );
      }
    } catch {
      setErrorMessage(
        "We could not send a new code. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setErrorMessage(null);
    setLoading(true);
    try {
      await logout();
      router.replace("/(auth)/portal" as any);
    } catch (error) {
      console.error("[Auth] sign out from email verification failed:", error);
      setErrorMessage("Could not sign out. Please try again.");
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 24 : insets.top + 10;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#0F2747", "#2563EB", "#0D9488"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad }]}
      >
        <HelpChainLogo width={204} height={124} light />
        <Text style={styles.slogan}>Help together. Grow together.</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.iconCircle}>
            <Feather name="mail" size={25} color="#0D9488" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Verify Your Email
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {verificationServiceConfigured
              ? "Enter the 6-digit code we sent to "
              : "This account must be verified before you can continue. The verification service is not configured, so a code cannot be sent right now. "}
            <Text style={[styles.email, { color: colors.foreground }]}>
              {recipient}
            </Text>
            .
          </Text>

          {errorMessage && (
            <Text accessibilityRole="alert" style={styles.errorMessage}>
              {errorMessage}
            </Text>
          )}
          {statusMessage && (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.statusMessage,
                { color: colors.darkTeal, backgroundColor: colors.secondary },
              ]}
            >
              {statusMessage}
            </Text>
          )}

          {verificationServiceConfigured && (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                6-Digit Verification Code
              </Text>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                value={code}
                onChangeText={(value) =>
                  setCode(value.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="••••••"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="6-digit email verification code"
                textAlign="center"
              />

              <View style={styles.expiryRow}>
                <Feather
                  name="clock"
                  size={15}
                  color={remainingMs === 0 ? "#DC2626" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.expiryText,
                    {
                      color:
                        remainingMs === 0 ? "#DC2626" : colors.mutedForeground,
                    },
                  ]}
                >
                  {remainingMs === null
                    ? "Request a code to start the verification timer"
                    : remainingMs === 0
                      ? "This code has expired"
                      : `Code expires in ${formatCountdown(remainingMs)}`}
                </Text>
              </View>

              <Pressable
                onPress={handleVerify}
                disabled={loading || code.length !== 6 || remainingMs === 0}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    opacity:
                      pressed ||
                      loading ||
                      code.length !== 6 ||
                      remainingMs === 0
                        ? 0.65
                        : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify Email</Text>
                )}
              </Pressable>

              <View style={styles.resendRow}>
                <Text
                  style={[styles.resendText, { color: colors.mutedForeground }]}
                >
                  Didn't receive the code?{" "}
                </Text>
                <Pressable
                  onPress={handleResend}
                  disabled={loading || resendRemainingMs > 0}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.resendLink,
                      {
                        color:
                          resendRemainingMs > 0
                            ? colors.mutedForeground
                            : colors.primary,
                      },
                    ]}
                  >
                    {resendRemainingMs > 0
                      ? `Resend in ${formatCountdown(resendRemainingMs)}`
                      : "Resend OTP"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <Pressable
            onPress={handleSignOut}
            disabled={loading}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.signOutButton,
              {
                borderColor: colors.border,
                opacity: pressed || loading ? 0.65 : 1,
              },
            ]}
          >
            <Text style={[styles.signOutButtonText, { color: colors.primary }]}>
              Sign out and use another account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  slogan: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    padding: 24,
    borderWidth: 1,
    borderRadius: 22,
    gap: 14,
    shadowColor: "#0F2747",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    textAlign: "center",
    fontSize: 25,
    fontFamily: "Inter_700Bold",
  },
  description: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  email: { fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  codeInput: {
    height: 58,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 25,
    letterSpacing: 13,
    fontFamily: "Inter_700Bold",
    paddingLeft: 20,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  expiryText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  resendText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resendLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  signOutButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  signOutButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorMessage: {
    color: "#B91C1C",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
  },
  statusMessage: {
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
  },
});
