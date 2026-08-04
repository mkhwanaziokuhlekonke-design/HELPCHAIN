import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useColors } from "@/hooks/useColors";

// Lazy-import WebView only on native to avoid web bundle issues
let WebView: any = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

function buildLeafletHTML(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
      .setView([${lat}, ${lng}], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var icon = L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;background:#2563EB;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([${lat}, ${lng}], { icon: icon })
      .addTo(map)
      .bindPopup('<b>Your location</b>')
      .openPopup();

    // Accuracy circle
    L.circle([${lat}, ${lng}], { radius: 80, color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.08, weight: 1 }).addTo(map);
  </script>
</body>
</html>`;
}

/** Web: render using <iframe srcdoc> so Leaflet loads cleanly without X-Frame-Options issues */
function WebLeafletMap({ lat, lng }: { lat: number; lng: number }) {
  const html = buildLeafletHTML(lat, lng);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcdoc = html;
    }
  }, [html]);

  return React.createElement("iframe", {
    ref,
    title: "Live location map",
    srcDoc: html,
    style: {
      width: "100%",
      height: "220px",
      border: "none",
      borderRadius: "12px",
      display: "block",
    } as React.CSSProperties,
    sandbox: "allow-scripts allow-same-origin",
  });
}

export function LiveLocationMap() {
  const colors = useColors();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    async function start() {
      try {
        if (Platform.OS === "web") {
          if (!("geolocation" in navigator)) {
            setError("Geolocation not supported by your browser.");
            setLoading(false);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
              setLoading(false);
            },
            () => {
              // Fall back to approximate location (London) if denied
              setCoords({ latitude: 51.505, longitude: -0.09, accuracy: null });
              setLoading(false);
            },
            { timeout: 8000, enableHighAccuracy: false }
          );
          return;
        }

        // Native path
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied. Enable it in Settings.");
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
        setLoading(false);

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
          (l) => {
            setCoords({
              latitude: l.coords.latitude,
              longitude: l.coords.longitude,
              accuracy: l.coords.accuracy,
            });
          }
        );
      } catch {
        setError("Unable to get your location.");
        setLoading(false);
      }
    }

    start();
    return () => {
      sub?.remove();
    };
  }, []);

  const fmt = (n: number, d: number) => n.toFixed(d);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.titleRow}>
        <View style={[styles.liveDot, coords ? styles.liveDotActive : styles.liveDotInactive]} />
        <Text style={[styles.title, { color: colors.foreground }]}>Live Location</Text>
        {coords && (
          <Text style={[styles.accuracy, { color: colors.mutedForeground }]}>
            {coords.accuracy ? `±${Math.round(coords.accuracy)}m` : "GPS"}
          </Text>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.centreBox}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={[styles.centreText, { color: colors.mutedForeground }]}>
            Getting your location…
          </Text>
        </View>
      )}

      {/* Error */}
      {error && !loading && (
        <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
          <Feather name="map-pin" size={18} color="#DC2626" />
          <Text style={[styles.errorText, { color: "#DC2626" }]}>{error}</Text>
        </View>
      )}

      {/* Map */}
      {coords && !loading && (
        <>
          <View style={styles.mapWrapper}>
            {Platform.OS === "web" ? (
              <WebLeafletMap lat={coords.latitude} lng={coords.longitude} />
            ) : (
              WebView ? (
                <WebView
                  source={{ html: buildLeafletHTML(coords.latitude, coords.longitude) }}
                  style={styles.nativeMap}
                  scrollEnabled={false}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                  renderLoading={() => (
                    <View style={[styles.nativeMap, { alignItems: "center", justifyContent: "center" }]}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )}
                />
              ) : (
                <View style={[styles.nativeMap, { alignItems: "center", justifyContent: "center", backgroundColor: "#DBEAFE" }]}>
                  <Feather name="map" size={28} color={colors.primary} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6, fontFamily: "Inter_400Regular" }}>
                    Map unavailable
                  </Text>
                </View>
              )
            )}
          </View>

          {/* Coordinates strip */}
          <View style={[styles.coordsRow, { borderTopColor: colors.border }]}>
            <Feather name="crosshair" size={12} color={colors.mutedForeground} />
            <Text style={[styles.coordText, { color: colors.mutedForeground }]}>
              {fmt(coords.latitude, 5)}, {fmt(coords.longitude, 5)}
            </Text>
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
  },
  liveDotActive: { backgroundColor: "#22C55E" },
  liveDotInactive: { backgroundColor: "#9CA3AF" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  accuracy: { fontSize: 11, fontFamily: "Inter_400Regular" },
  centreBox: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 16,
  },
  centreText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  mapWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    height: 224,
  },
  nativeMap: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  coordText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
