import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useColors } from "@/hooks/useColors";

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

function OSMWebMap({ lat, lng }: { lat: number; lng: number }) {
  const delta = 0.008;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
  return React.createElement("iframe", {
    src,
    title: "Your live location",
    style: {
      width: "100%",
      height: 220,
      border: "none",
      borderRadius: 16,
    } as any,
    loading: "lazy",
  });
}

export function LiveLocationMap() {
  const colors = useColors();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    async function start() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied");
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
        setLoading(false);

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          (loc) => {
            setCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
            });
            setTick((t) => t + 1);
          }
        );
      } catch {
        setError("Unable to get location");
        setLoading(false);
      }
    }

    start();
    return () => { sub?.remove(); };
  }, []);

  const fmt = (n: number, d: number) => n.toFixed(d);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.titleRow}>
        <View style={styles.liveDot} />
        <Text style={[styles.title, { color: colors.foreground }]}>Live Location</Text>
        {coords && (
          <Text style={[styles.accuracy, { color: colors.mutedForeground }]}>
            ±{Math.round(coords.accuracy ?? 0)}m
          </Text>
        )}
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Getting your location…
          </Text>
        </View>
      )}

      {error && !loading && (
        <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
          <Feather name="map-pin" size={18} color="#DC2626" />
          <Text style={[styles.errorText, { color: "#DC2626" }]}>{error}</Text>
        </View>
      )}

      {coords && !loading && (
        <>
          {Platform.OS === "web" ? (
            <View style={styles.mapWrapper}>
              <OSMWebMap key={tick} lat={coords.latitude} lng={coords.longitude} />
            </View>
          ) : (
            <View style={[styles.nativeMapPlaceholder, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="map" size={32} color={colors.primary} />
              <Text style={[styles.nativeMapText, { color: colors.foreground }]}>
                Map available on device
              </Text>
            </View>
          )}

          <View style={styles.coordsRow}>
            <View style={styles.coordItem}>
              <Feather name="crosshair" size={12} color={colors.mutedForeground} />
              <Text style={[styles.coordLabel, { color: colors.mutedForeground }]}>Lat</Text>
              <Text style={[styles.coordVal, { color: colors.foreground }]}>
                {fmt(coords.latitude, 5)}
              </Text>
            </View>
            <View style={[styles.coordDivider, { backgroundColor: colors.border }]} />
            <View style={styles.coordItem}>
              <Feather name="crosshair" size={12} color={colors.mutedForeground} />
              <Text style={[styles.coordLabel, { color: colors.mutedForeground }]}>Lng</Text>
              <Text style={[styles.coordVal, { color: colors.foreground }]}>
                {fmt(coords.longitude, 5)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  accuracy: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  loadingBox: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 16,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  mapWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    height: 220,
  },
  nativeMapPlaceholder: {
    height: 160,
    marginHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 4,
  },
  nativeMapText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  coordItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  coordLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  coordVal: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  coordDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 12,
  },
});
