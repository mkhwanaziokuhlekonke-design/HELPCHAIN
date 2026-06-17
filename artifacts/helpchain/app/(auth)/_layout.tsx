import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="portal" />
      <Stack.Screen name="login" />
      <Stack.Screen name="admin-login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="location" />
    </Stack>
  );
}
