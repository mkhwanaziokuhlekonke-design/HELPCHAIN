import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HelpRequestCard } from "@/components/HelpRequestCard";
import { useAuth } from "@/context/AuthContext";
import { HelpRequest, useHelp } from "@/context/HelpContext";
import { useColors } from "@/hooks/useColors";

type FilterType = "all" | "emergency" | "open" | "mine" | "accepted";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "emergency", label: "Emergency" },
  { key: "open", label: "Open" },
  { key: "mine", label: "My Requests" },
  { key: "accepted", label: "Accepted" },
];

export default function RequestsScreen() {
  const colors = useColors();
  const { requests } = useHelp();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  function getFiltered(): HelpRequest[] {
    switch (filter) {
      case "emergency":
        return requests.filter((r) => r.isEmergency && r.status === "open");
      case "open":
        return requests.filter((r) => r.status === "open");
      case "mine":
        return requests.filter((r) => r.requesterId === user?.id);
      case "accepted":
        return requests.filter((r) => r.status === "accepted");
      default:
        return requests;
    }
  }

  const filtered = getFiltered();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Help Requests</Text>
        <Pressable
          onPress={() => router.push("/request/new" as any)}
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          keyExtractor={(i) => i.key}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === item.key ? colors.primary : colors.secondary,
                  borderColor: filter === item.key ? colors.primary : colors.border,
                },
              ]}
            >
              {item.key === "emergency" && (
                <Feather name="alert-triangle" size={11} color={filter === item.key ? "#FFFFFF" : colors.emergency} />
              )}
              <Text
                style={[
                  styles.filterText,
                  { color: filter === item.key ? "#FFFFFF" : colors.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <HelpRequestCard request={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No requests found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {filter === "mine"
                ? "You haven't created any help requests yet."
                : "There are no requests in this category right now."}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  newBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBar: {
    borderBottomWidth: 1,
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  list: {
    padding: 16,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 20,
  },
});
