import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { HelpCategory } from "@/context/HelpContext";

interface CategoryBadgeProps {
  category: HelpCategory;
  isEmergency?: boolean;
  size?: "sm" | "md";
}

const CATEGORY_CONFIG: Record<HelpCategory, { label: string; icon: string; bg: string; text: string }> = {
  emergency: { label: "Emergency", icon: "alert-triangle", bg: "#F8FAFC", text: "#EF4444" },
  medical: { label: "Medical", icon: "heart", bg: "#F8FAFC", text: "#EF4444" },
  food: { label: "Food", icon: "shopping-bag", bg: "#ECFDF5", text: "#10B981" },
  transport: { label: "Transport", icon: "truck", bg: "#EFF6FF", text: "#2563EB" },
  daily: { label: "Daily Task", icon: "tool", bg: "#F8FAFC", text: "#F59E0B" },
  other: { label: "Other", icon: "help-circle", bg: "#EFF6FF", text: "#7C3AED" },
};

export function CategoryBadge({ category, isEmergency = false, size = "md" }: CategoryBadgeProps) {
  const config = isEmergency ? CATEGORY_CONFIG["emergency"] : CATEGORY_CONFIG[category];
  const isSmall = size === "sm";

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, paddingHorizontal: isSmall ? 8 : 10, paddingVertical: isSmall ? 3 : 5 }]}>
      <Feather name={config.icon as any} size={isSmall ? 10 : 12} color={config.text} />
      <Text style={[styles.label, { color: config.text, fontSize: isSmall ? 10 : 11 }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    gap: 4,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
  },
});
