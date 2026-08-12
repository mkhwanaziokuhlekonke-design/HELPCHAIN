/**
 * NavigationMap — guides the helper to the requester's pinned location.
 *
 * • Shows helper's real-time GPS as a blue pulsing dot (updates via postMessage)
 * • Shows requester's fixed position as a red pin
 * • Draws an OSRM driving route between them (fetched inside the WebView/iframe)
 * • Live distance + ETA badge, "Open in Maps" button for native navigation
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocation } from "@/context/LocationContext";

let WebView: any = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

// ─── Haversine distance (km) ──────────────────────────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
function fmtEta(km: number): string {
  // ~30 km/h average urban driving
  const mins = Math.round((km / 30) * 60);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── "Open in Maps" deep link ─────────────────────────────────────────────
function openNativeNav(lat: number, lng: number, label: string) {
  const encoded = encodeURIComponent(label);
  if (Platform.OS === "ios") {
    Linking.openURL(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
  } else if (Platform.OS === "android") {
    Linking.openURL(`google.navigation:q=${lat},${lng}&mode=d`);
  } else {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encoded}&travelmode=driving`
    );
  }
}

// ─── Leaflet HTML (self-contained: draws route, listens for helper updates) ─
function buildNavHtml(
  helperLat: number,
  helperLng: number,
  reqLat: number,
  reqLng: number,
  requesterName: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
    @keyframes pulse {
      0%   { transform:scale(1);   opacity:0.9; }
      50%  { transform:scale(1.6); opacity:0.3; }
      100% { transform:scale(1);   opacity:0.9; }
    }
    .helper-ring {
      width:44px; height:44px; border-radius:50%;
      background:rgba(37,99,235,0.25); border:2px solid #2563EB;
      animation:pulse 1.8s ease-in-out infinite;
      position:absolute; top:-12px; left:-12px;
    }
    .helper-dot {
      width:20px; height:20px; border-radius:50%;
      background:#2563EB; border:3px solid #fff;
      box-shadow:0 2px 8px rgba(37,99,235,0.6);
      position:absolute; top:0; left:0;
    }
    .helper-wrap { position:relative; width:20px; height:20px; }
    .req-pin-wrap { display:flex; flex-direction:column; align-items:center; }
    .req-pin {
      width:22px; height:22px; border-radius:50% 50% 50% 0;
      background:#DC2626; border:3px solid #fff;
      box-shadow:0 2px 8px rgba(220,38,38,0.5);
      transform:rotate(-45deg);
    }
    .req-shadow {
      width:10px; height:4px; border-radius:50%;
      background:rgba(0,0,0,0.25); margin-top:2px;
    }
    /* Info panel inside map */
    #info-panel {
      position:absolute; bottom:12px; left:50%; transform:translateX(-50%);
      background:rgba(15,23,42,0.88); color:#fff; border-radius:16px;
      padding:10px 18px; font-family:sans-serif; font-size:13px;
      display:flex; align-items:center; gap:12px; z-index:1000; white-space:nowrap;
      backdrop-filter:blur(6px);
    }
    .dot-green { width:8px; height:8px; border-radius:50%; background:#22C55E; flex-shrink:0; }
    #dist-label { font-weight:700; font-size:15px; }
    #eta-label { opacity:0.75; }
  </style>
</head>
<body>
<div id="map"></div>
<div id="info-panel">
  <div class="dot-green"></div>
  <span id="dist-label">Calculating…</span>
  <span id="eta-label"></span>
</div>
<script>
  var helperLatLng = [${helperLat}, ${helperLng}];
  var reqLatLng    = [${reqLat},    ${reqLng}];
  var requesterName = ${JSON.stringify(requesterName)};

  // Mid-point for initial view
  var midLat = (helperLatLng[0] + reqLatLng[0]) / 2;
  var midLng = (helperLatLng[1] + reqLatLng[1]) / 2;

  var map = L.map('map', { zoomControl:false, attributionControl:false })
    .setView([midLat, midLng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);
  L.control.zoom({ position:'topright' }).addTo(map);

  // ── Requester pin ────────────────────────────────────────────────────
  var reqIcon = L.divIcon({
    className:'',
    html:'<div class="req-pin-wrap"><div class="req-pin"></div><div class="req-shadow"></div></div>',
    iconSize:[22,28], iconAnchor:[11,28], popupAnchor:[0,-30],
  });
  var reqMarker = L.marker(reqLatLng, { icon:reqIcon })
    .addTo(map)
    .bindPopup('<b style="font-family:sans-serif;">' + requesterName + ' (needs help)</b>')
    .openPopup();

  // ── Helper dot ───────────────────────────────────────────────────────
  var helperIcon = L.divIcon({
    className:'',
    html:'<div class="helper-wrap"><div class="helper-ring"></div><div class="helper-dot"></div></div>',
    iconSize:[20,20], iconAnchor:[10,10], popupAnchor:[0,-12],
  });
  var helperMarker = L.marker(helperLatLng, { icon:helperIcon })
    .addTo(map)
    .bindPopup('<b style="font-family:sans-serif;">You (helper)</b>');

  // ── Route polyline ───────────────────────────────────────────────────
  var routeLine = null;

  function updateInfo(lat1, lng1) {
    var R = 6371;
    var dLat = (reqLatLng[0]-lat1)*Math.PI/180;
    var dLng = (reqLatLng[1]-lng1)*Math.PI/180;
    var a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(reqLatLng[0]*Math.PI/180)*Math.sin(dLng/2)**2;
    var km = R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var distTxt = km < 1 ? Math.round(km*1000)+' m' : km.toFixed(1)+' km';
    var mins = Math.round((km/30)*60);
    var etaTxt = mins < 1 ? '< 1 min' : mins < 60 ? mins+' min' : Math.floor(mins/60)+'h '+mins%60+'m';
    document.getElementById('dist-label').textContent = distTxt;
    document.getElementById('eta-label').textContent = etaTxt + ' away';
  }

  function drawRoute(lat1, lng1) {
    var url = 'https://router.project-osrm.org/route/v1/driving/'
      + lng1+','+lat1+';'+reqLatLng[1]+','+reqLatLng[0]
      + '?overview=full&geometries=geojson';
    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data) {
        if (!data.routes || !data.routes[0]) return;
        var coords = data.routes[0].geometry.coordinates.map(function(c){ return [c[1],c[0]]; });
        if (routeLine) { routeLine.remove(); routeLine = null; }
        routeLine = L.polyline(coords, {
          color:'#2563EB', weight:5, opacity:0.85,
          dashArray: null,
          lineCap:'round', lineJoin:'round',
        }).addTo(map);
        // Fit both markers + route
        var bounds = L.latLngBounds([helperMarker.getLatLng(), reqMarker.getLatLng()]);
        map.fitBounds(bounds, { padding:[48,48] });
      })
      .catch(function() {
        // Fallback: straight dashed line
        if (routeLine) { routeLine.remove(); }
        routeLine = L.polyline([helperMarker.getLatLng(), reqMarker.getLatLng()], {
          color:'#2563EB', weight:4, opacity:0.6, dashArray:'10,8',
        }).addTo(map);
        var bounds = L.latLngBounds([helperMarker.getLatLng(), reqMarker.getLatLng()]);
        map.fitBounds(bounds, { padding:[48,48] });
      });
  }

  updateInfo(helperLatLng[0], helperLatLng[1]);
  drawRoute(helperLatLng[0], helperLatLng[1]);

  // ── Live helper position updates ──────────────────────────────────────
  function applyUpdate(msg) {
    if (!msg) return;

    // ── Helper moved ─────────────────────────────────────────────────
    if (msg.type === 'UPDATE_HELPER') {
      var lat = msg.lat, lng = msg.lng;
      helperMarker.setLatLng([lat, lng]);
      updateInfo(lat, lng);
      var prev = helperLatLng;
      var dLat = lat - prev[0], dLng = lng - prev[1];
      var moved = Math.sqrt(dLat*dLat + dLng*dLng) * 111000;
      helperLatLng = [lat, lng];
      if (moved > 50) drawRoute(lat, lng);
      if (!map.getBounds().contains([lat, lng])) {
        map.panTo([lat, lng], { animate:true, duration:0.8 });
      }
    }

    // ── Requester moved (live GPS from presence) ──────────────────────
    if (msg.type === 'UPDATE_DESTINATION') {
      reqLatLng = [msg.lat, msg.lng];
      reqMarker.setLatLng(reqLatLng);
      updateInfo(helperLatLng[0], helperLatLng[1]);
      drawRoute(helperLatLng[0], helperLatLng[1]);
      var bounds = L.latLngBounds([helperMarker.getLatLng(), reqMarker.getLatLng()]);
      map.fitBounds(bounds, { padding:[48,48] });
    }
  }

  window.addEventListener('message', function(e) {
    try { applyUpdate(typeof e.data === 'string' ? JSON.parse(e.data) : e.data); } catch(_){}
  });
  document.addEventListener('message', function(e) {
    try { applyUpdate(JSON.parse(e.data)); } catch(_){}
  });
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────
export interface NavigationMapProps {
  requesterCoords: { latitude: number; longitude: number };
  requesterName: string;
  requesterAddress?: string;
  /** Pass the requester's uid so the map can track their live GPS from presence. */
  requesterUid?: string;
  fullScreen?: boolean;
  onClose?: () => void;
}

export function NavigationMap({
  requesterCoords,
  requesterName,
  requesterAddress,
  requesterUid,
  fullScreen = false,
  onClose,
}: NavigationMapProps) {
  const { myCoords, userLocations } = useLocation();
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const prevHelperRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const prevDestRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Live requester position from presence — updates in real time if they have GPS on
  const liveRequester = requesterUid
    ? userLocations.find((u) => u.uid === requesterUid)
    : null;
  const destCoords = liveRequester
    ? { latitude: liveRequester.latitude, longitude: liveRequester.longitude }
    : requesterCoords;

  // Fallback helper start if GPS not yet ready
  const helperStart = myCoords ?? {
    latitude: destCoords.latitude + 0.002,
    longitude: destCoords.longitude + 0.002,
  };

  const [distance, setDistance] = useState<string | null>(null);
  const [eta, setEta] = useState<string | null>(null);

  // Keep distance/ETA updated as helper or requester moves
  useEffect(() => {
    if (!myCoords) return;
    const km = haversineKm(
      myCoords.latitude, myCoords.longitude,
      destCoords.latitude, destCoords.longitude
    );
    setDistance(fmtDistance(km));
    setEta(fmtEta(km));
  }, [myCoords, destCoords]);

  function pushToMap(payload: string) {
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    } else if (webViewRef.current && readyRef.current) {
      webViewRef.current.injectJavaScript(`
        (function(){
          var p = ${JSON.stringify(payload)};
          window.dispatchEvent(new MessageEvent('message', { data: p }));
          document.dispatchEvent(new MessageEvent('message', { data: p }));
        })(); true;
      `);
    }
  }

  // Push helper position updates to the map
  useEffect(() => {
    if (!myCoords) return;
    const prev = prevHelperRef.current;
    if (prev && prev.latitude === myCoords.latitude && prev.longitude === myCoords.longitude) return;
    prevHelperRef.current = myCoords;
    pushToMap(JSON.stringify({ type: "UPDATE_HELPER", lat: myCoords.latitude, lng: myCoords.longitude }));
  }, [myCoords]);

  // Push requester live position updates to the map
  useEffect(() => {
    if (!liveRequester) return;
    const prev = prevDestRef.current;
    if (prev && prev.latitude === destCoords.latitude && prev.longitude === destCoords.longitude) return;
    prevDestRef.current = destCoords;
    pushToMap(JSON.stringify({ type: "UPDATE_DESTINATION", lat: destCoords.latitude, lng: destCoords.longitude }));
  }, [destCoords]);

  const html = buildNavHtml(
    helperStart.latitude,
    helperStart.longitude,
    destCoords.latitude,
    destCoords.longitude,
    requesterName
  );

  const containerStyle = fullScreen ? StyleSheet.absoluteFill : styles.cardContainer;

  return (
    <View style={containerStyle}>
      {/* ── Map ── */}
      {Platform.OS === "web" ? (
        <iframe
          ref={iframeRef as any}
          title="Navigation map"
          srcDoc={html}
          style={fullScreen
            ? { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" } as any
            : { width: "100%", height: "100%", border: "none", display: "block" } as any}
          sandbox="allow-scripts allow-same-origin"
        />
      ) : WebView ? (
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          onLoadEnd={() => { readyRef.current = true; }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <ActivityIndicator color="#2563EB" />
        </View>
      )}

      {/* ── Top bar (full-screen mode) ── */}
      {fullScreen && (
        <View style={styles.topBar}>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Feather name="chevron-down" size={22} color="#fff" />
            </Pressable>
          )}
          <View style={styles.topInfo}>
            <View style={styles.liveDot} />
            <Text style={styles.topName} numberOfLines={1}>{requesterName}</Text>
          </View>
          <Pressable
            style={styles.openMapsBtn}
            onPress={() => openNativeNav(
              requesterCoords.latitude,
              requesterCoords.longitude,
              requesterName
            )}
          >
            <Feather name="navigation" size={14} color="#fff" />
            <Text style={styles.openMapsText}>Navigate</Text>
          </Pressable>
        </View>
      )}

      {/* ── Bottom sheet (full-screen mode) ── */}
      {fullScreen && distance && (
        <View style={styles.bottomSheet}>
          <View style={styles.bottomRow}>
            <View>
              <Text style={styles.distValue}>{distance}</Text>
              <Text style={styles.etaValue}>{eta} away · driving</Text>
            </View>
            {requesterAddress && (
              <Text style={styles.address} numberOfLines={2}>{requesterAddress}</Text>
            )}
          </View>
        </View>
      )}

      {/* ── Loading overlay while GPS initialises ── */}
      {!myCoords && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.gpsText}>Finding your location…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    height: 240,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: Platform.OS === "ios" ? 52 : 12,
    backgroundColor: "rgba(15,23,42,0.75)",
    gap: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  topInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  topName: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  openMapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  openMapsText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15,23,42,0.88)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  distValue: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  etaValue: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  address: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  gpsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  gpsText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
