import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface UserAvatarProps {
  name: string;
  size?: number;
  isAdmin?: boolean;
}

export function UserAvatar({ name, size = 40, isAdmin = false }: UserAvatarProps) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isAdmin ? colors.accent : colors.primary,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize, color: colors.primaryForeground }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "Inter_700Bold",
  },
});
