import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface UserAvatarProps {
  name: string;
  size?: number;
  isAdmin?: boolean;
  /** Show a WhatsApp-style online dot when true */
  online?: boolean;
}

export function UserAvatar({ name, size = 40, isAdmin = false, online }: UserAvatarProps) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const fontSize = size * 0.38;
  const dotSize = Math.max(9, size * 0.26);

  return (
    <View style={{ width: size, height: size }}>
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
        <Text style={[styles.initials, { fontSize, color: colors.primaryForeground }]}>
          {initials}
        </Text>
      </View>

      {/* Online indicator dot — only rendered when online prop is provided */}
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              bottom: 0,
              right: 0,
              backgroundColor: online ? "#22C55E" : "#94A3B8",
              borderWidth: Math.max(1.5, dotSize * 0.2),
            },
          ]}
        />
      )}
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
  dot: {
    position: "absolute",
    borderColor: "#fff",
  },
});
