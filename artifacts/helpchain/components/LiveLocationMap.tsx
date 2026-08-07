import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocation, UserLocation } from "@/context/LocationContext";

// Lazy-import WebView only on native to avoid web bundle issues
let WebView: any = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

// ── colour palette — one per user, deterministic from uid ────────────────
const PALETTE = [
  "#2563EB", "#DC2626", "#16A34A", "#D97706", "#7C3AED",
  "#DB2777", "#0891B2", "#65A30D", "#EA580C", "#6366F1",
];
function colorForUid(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ── build full Leaflet HTML (initial render + postMessage listener) ───────
function buildLeafletHTML(users: UserLocation[], centerLat: number, centerLng: number): string {
  const usersJson = JSON.stringify(
    users.map((u) => ({
      uid: u.uid,
      name: u.name,
      lat: u.latitude,
      lng: u.longitude,
      isMe: u.isMe,
      color: colorForUid(u.uid),
    }))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    @keyframes pulse {
      0%   { transform: scale(1);   opacity: 0.9; }
      50%  { transform: scale(1.5); opacity: 0.4; }
      100% { transform: scale(1);   opacity: 0.9; }
    }
    .pulse-ring {
      width: 36px; height: 36px; border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
      position: absolute; top: -8px; left: -8px;
    }
    .dot-wrap { position: relative; width: 20px; height: 20px; }
    .dot { width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false })
    .setView([${centerLat}, ${centerLng}], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  var markers = {};

  function makeIcon(color, isMe) {
    var inner = isMe
      ? '<div class="dot-wrap"><div class="pulse-ring" style="background:' + color + '22;border:2px solid ' + color + ';"></div><div class="dot" style="background:' + color + ';"></div></div>'
      : '<div class="dot" style="background:' + color + ';width:16px;height:16px;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>';
    return L.divIcon({
      className: '',
      html: inner,
      iconSize: isMe ? [20, 20] : [16, 16],
      iconAnchor: isMe ? [10, 10] : [8, 8],
      popupAnchor: [0, isMe ? -14 : -10],
    });
  }

  function renderUsers(users) {
    // Remove stale markers
    var incoming = {};
    users.forEach(function(u) { incoming[u.uid] = true; });
    Object.keys(markers).forEach(function(uid) {
      if (!incoming[uid]) { markers[uid].remove(); delete markers[uid]; }
    });

    users.forEach(function(u) {
      var icon = makeIcon(u.color, u.isMe);
      var label = u.isMe ? 'You (' + u.name + ')' : u.name;
      if (markers[u.uid]) {
        markers[u.uid].setLatLng([u.lat, u.lng]).setIcon(icon);
      } else {
        markers[u.uid] = L.marker([u.lat, u.lng], { icon: icon })
          .addTo(map)
          .bindPopup('<b style="font-family:sans-serif;">' + label + '</b>');
      }
    });
  }

  // Initial render
  var initialUsers = ${usersJson};
  renderUsers(initialUsers);

  // Open your own popup
  var meEntry = initialUsers.find(function(u) { return u.isMe; });
  if (meEntry && markers[meEntry.uid]) {
    markers[meEntry.uid].openPopup();
  }

  // Live updates via postMessage
  window.addEventListener('message', function(e) {
    try {
      var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (msg && msg.type === 'UPDATE_LOCATIONS') {
        renderUsers(msg.users);
      }
    } catch(_) {}
  });

  // Also listen on document for React Native WebView
  document.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg && msg.type === 'UPDATE_LOCATIONS') {
        renderUsers(msg.users);
      }
    } catch(_) {}
  });
</script>
</body>
</html>`;
}

// ── helpers to push live updates without reloading ───────────────────────
function buildUpdatePayload(users: UserLocation[]): string {
  return JSON.stringify({
    type: "UPDATE_LOCATIONS",
    users: users.map((u) => ({
      uid: u.uid,
      name: u.name,
      lat: u.latitude,
      lng: u.longitude,
      isMe: u.isMe,
      color: colorForUid(u.uid),
    })),
  });
}

// ── Web iframe component ──────────────────────────────────────────────────
function WebLeafletMap({
  users,
  centerLat,
  centerLng,
  fullScreen,
}: {
  users: UserLocation[];
  centerLat: number;
  centerLng: number;
  fullScreen?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mountedRef = useRef(false);

  // Initial render
  useEffect(() => {
    if (iframeRef.current && !mountedRef.current) {
      iframeRef.current.srcdoc = buildLeafletHTML(users, centerLat, centerLng);
      mountedRef.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates — push via postMessage once the iframe is ready
  useEffect(() => {
    if (!mountedRef.current || !iframeRef.current) return;
    const frame = iframeRef.current;
    const payload = buildUpdatePayload(users);
    // Small delay to ensure Leaflet is initialised before the first push
    const t = setTimeout(() => {
      frame.contentWindow?.postMessage(payload, "*");
    }, 400);
    return () => clearTimeout(t);
  }, [users]);

  return React.createElement("iframe", {
    ref: iframeRef,
    title: "Live location map",
    style: (fullScreen
      ? { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", display: "block" }
      : { width: "100%", height: "220px", border: "none", borderRadius: "12px", display: "block" }
    ) as React.CSSProperties,
    sandbox: "allow-scripts allow-same-origin",
  });
}

// ── Native WebView component ──────────────────────────────────────────────
function NativeLeafletMap({
  users,
  centerLat,
  centerLng,
  style,
}: {
  users: UserLocation[];
  centerLat: number;
  centerLng: number;
  style?: object;
}) {
  const webViewRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  function pushUpdate(u: UserLocation[]) {
    const payload = buildUpdatePayload(u);
    if (!readyRef.current || !webViewRef.current) {
      pendingRef.current = payload;
      return;
    }
    webViewRef.current.injectJavaScript(`
      (function(){
        var payload = ${JSON.stringify(payload)};
        window.postMessage(payload, '*');
        document.dispatchEvent(new MessageEvent('message', { data: payload }));
      })();
      true;
    `);
  }

  // Push location updates whenever users change (after initial load)
  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
    pushUpdate(users);
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!WebView) return null;

  const center = users.find((u) => u.isMe) ?? users[0];
  const lat = center?.latitude ?? centerLat;
  const lng = center?.longitude ?? centerLng;

  return (
    <WebView
      ref={webViewRef}
      source={{ html: buildLeafletHTML(users, lat, lng) }}
      style={[{ flex: 1 }, style]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      onLoadEnd={() => {
        readyRef.current = true;
        if (pendingRef.current) {
          const p = pendingRef.current;
          pendingRef.current = null;
          webViewRef.current?.injectJavaScript(`
            (function(){
              var payload = ${JSON.stringify(pendingRef.current ?? p)};
              window.postMessage(payload, '*');
              document.dispatchEvent(new MessageEvent('message', { data: payload }));
            })();
            true;
          `);
        }
      }}
    />
  );
}

// ── Main exported component ───────────────────────────────────────────────
interface LiveLocationMapProps {
  fullScreen?: boolean;
}

export function LiveLocationMap({ fullScreen = false }: LiveLocationMapProps) {
  const { myCoords, userLocations, locationError, locationReady } = useLocation();

  const center = myCoords
    ?? (userLocations[0] ? { latitude: userLocations[0].latitude, longitude: userLocations[0].longitude } : null)
    ?? { latitude: 51.505, longitude: -0.09 }; // London fallback

  const onlineCount = userLocations.filter((u) => !u.isMe).length;

  if (fullScreen) {
    return (
      <View style={StyleSheet.absoluteFill}>
        {!locationReady && !locationError && (
          <View style={[StyleSheet.absoluteFill, styles.loadOverlay]}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadText}>Getting your location…</Text>
          </View>
        )}
        {locationError && !locationReady && (
          <View style={[StyleSheet.absoluteFill, styles.loadOverlay]}>
            <Feather name="map-pin" size={32} color="rgba(255,255,255,0.6)" />
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        )}
        {(locationReady || locationError) && (
          Platform.OS === "web" ? (
            <WebLeafletMap
              users={userLocations}
              centerLat={center.latitude}
              centerLng={center.longitude}
              fullScreen
            />
          ) : WebView ? (
            <NativeLeafletMap
              users={userLocations}
              centerLat={center.latitude}
              centerLng={center.longitude}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.loadOverlay]}>
              <Feather name="map" size={32} color="rgba(255,255,255,0.6)" />
            </View>
          )
        )}

        {/* Live badge — top-right corner */}
        {locationReady && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>
              {onlineCount > 0
                ? `${onlineCount + 1} people live`
                : "You're live"}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Card mode ────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, locationReady ? styles.dotActive : styles.dotInactive]} />
        <Text style={styles.title}>Live Map</Text>
        {locationReady && (
          <Text style={styles.subtitle}>
            {onlineCount > 0 ? `${onlineCount} other${onlineCount === 1 ? "" : "s"} nearby` : "Only you online"}
          </Text>
        )}
      </View>

      {!locationReady && !locationError && (
        <View style={styles.centreBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.centreText}>Getting your location…</Text>
        </View>
      )}

      {locationError && (
        <View style={styles.errorBox}>
          <Feather name="map-pin" size={18} color="#DC2626" />
          <Text style={styles.errorMsg}>{locationError}</Text>
        </View>
      )}

      {(locationReady || (!locationError && !locationReady)) && (
        <View style={styles.mapWrapper}>
          {Platform.OS === "web" ? (
            <WebLeafletMap
              users={userLocations}
              centerLat={center.latitude}
              centerLng={center.longitude}
            />
          ) : WebView ? (
            <NativeLeafletMap
              users={userLocations}
              centerLat={center.latitude}
              centerLng={center.longitude}
              style={styles.nativeMap}
            />
          ) : (
            <View style={[styles.nativeMap, { alignItems: "center", justifyContent: "center", backgroundColor: "#DBEAFE" }]}>
              <Feather name="map" size={28} color="#2563EB" />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E3A8A",
    gap: 12,
  },
  loadText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  errorText: {
    color: "rgba(255,255,255,0.7)", fontSize: 13,
    fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32,
  },
  liveBadge: {
    position: "absolute", top: 12, right: 12,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  liveBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: {
    borderRadius: 18, overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  titleRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: { backgroundColor: "#22C55E" },
  dotInactive: { backgroundColor: "#9CA3AF" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", flex: 1 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  centreBox: { height: 160, alignItems: "center", justifyContent: "center", gap: 10 },
  centreText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, padding: 14, borderRadius: 12,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
  },
  errorMsg: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626", flex: 1 },
  mapWrapper: { paddingHorizontal: 12, paddingBottom: 4, height: 224 },
  nativeMap: { height: 220, borderRadius: 12, overflow: "hidden" },
});
