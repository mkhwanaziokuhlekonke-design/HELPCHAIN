import React, { useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

export interface CommunityCenter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
}

export const WEST_ACRES_CENTERS: CommunityCenter[] = [
  {
    id: "communio-church-west-acres",
    name: "Communio Church",
    address: "Jacaranda Road, West Acres, Mbombela, 1200",
    latitude: -25.4804,
    longitude: 30.9618,
    description: "Church outreach and community support",
  },
  {
    id: "ng-kerk-westergloed",
    name: "NG Kerk Westergloed",
    address: "36 Koraalboom Avenue, West Acres Central, Mbombela, 1211",
    latitude: -25.47712,
    longitude: 30.95831,
    description: "Church community centre",
  },
];

const WEST_ACRES_REFERENCE = { latitude: -25.4827667, longitude: 30.9538241 };

function distanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) {
  const earthRadius = 6371;
  const latitudeDelta = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const longitudeDelta = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((origin.latitude * Math.PI) / 180) *
      Math.cos((destination.latitude * Math.PI) / 180) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function buildMapHtml(
  origin: { latitude: number; longitude: number },
  selectedId: string | null
) {
  const centers = JSON.stringify(WEST_ACRES_CENTERS);
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;width:100%;height:100%;font-family:Arial,sans-serif}
  .me{width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 1px 6px rgba(37,99,235,.7)}
  .center{width:30px;height:30px;border-radius:15px;background:#0D9488;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)}
  .center.selected{background:#F59E0B;outline:4px solid rgba(245,158,11,.3)}
  .leaflet-popup-content{margin:10px 12px;font-size:12px}.leaflet-popup-content b{font-size:13px}
</style></head><body><div id="map"></div><script>
  var origin=[${origin.latitude},${origin.longitude}];
  var centers=${centers};
  var selectedId=${JSON.stringify(selectedId)};
  var map=L.map('map',{zoomControl:false,attributionControl:false}).setView(origin,14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  L.control.zoom({position:'topright'}).addTo(map);
  var bounds=L.latLngBounds([origin]);
  L.marker(origin,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]})})
    .addTo(map).bindPopup('<b>Your location</b>');
  function safeHtml(value){return String(value||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]})}
  function selectCenter(id){
    var payload=JSON.stringify({type:'SELECT_CENTER',id:id});
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(payload);else window.parent.postMessage(payload,'*');
  }
  centers.forEach(function(center){
    var selected=center.id===selectedId;
    var icon=L.divIcon({className:'',html:'<div class="center '+(selected?'selected':'')+'">⌂</div>',iconSize:[30,30],iconAnchor:[15,15]});
    var marker=L.marker([center.latitude,center.longitude],{icon:icon}).addTo(map)
      .bindPopup('<b>'+safeHtml(center.name)+'</b><br/>'+safeHtml(center.address));
    marker.on('click',function(){selectCenter(center.id);});
    bounds.extend([center.latitude,center.longitude]);
    L.polyline([origin,[center.latitude,center.longitude]],{color:selected?'#F59E0B':'#14B8A6',weight:selected?4:3,dashArray:'8,8',opacity:.8}).addTo(map);
  });
  map.fitBounds(bounds,{padding:[34,34],maxZoom:15});
</script></body></html>`;
}

export function CommunityCentersMap() {
  const colors = useColors();
  const { myCoords } = useLocation();
  const origin = myCoords ?? WEST_ACRES_REFERENCE;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mapSource = useMemo(() => buildMapHtml(origin, selectedId), [origin, selectedId]);

  function selectCenter(id: string) {
    if (WEST_ACRES_CENTERS.some((center) => center.id === id)) setSelectedId(id);
  }

  async function navigateTo(center: CommunityCenter) {
    const destination = encodeURIComponent(`${center.name}, ${center.address}`);
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    const nativeUrl =
      Platform.OS === "ios"
        ? `maps://maps.apple.com/?daddr=${destination}&dirflg=d`
        : Platform.OS === "android"
          ? `google.navigation:q=${destination}&mode=d`
          : fallbackUrl;

    try {
      const canNavigate = Platform.OS === "web" || (await Linking.canOpenURL(nativeUrl));
      await Linking.openURL(canNavigate ? nativeUrl : fallbackUrl);
    } catch {
      await Linking.openURL(fallbackUrl);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.tealLight }]}>
          <Feather name="map-pin" size={19} color={colors.teal} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>West Acres community centres</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Two places to donate in Mbombela, Mpumalanga
          </Text>
        </View>
      </View>

      <View style={styles.mapFrame}>
        {Platform.OS === "web" ? (
          <iframe
            ref={iframeRef as any}
            title="West Acres community centres map"
            srcDoc={mapSource}
            style={{ width: "100%", height: "100%", border: "none", display: "block" } as any}
          />
        ) : (
          <WebViewMap
            source={mapSource}
            webViewRef={webViewRef}
            onSelect={selectCenter}
          />
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
            {myCoords ? "You are here" : "West Acres reference"}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.teal }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Donation centre</Text>
        </View>
      </View>

      <View style={styles.centerList}>
        {WEST_ACRES_CENTERS.map((center) => {
          const selected = selectedId === center.id;
          const distance = distanceKm(origin, center);
          return (
            <View
              key={center.id}
              style={[
                styles.centerRow,
                {
                  backgroundColor: selected ? colors.tealLight : colors.background,
                  borderColor: selected ? colors.teal : colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() => selectCenter(center.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${center.name}`}
                accessibilityState={{ selected }}
                style={styles.centerInfo}
              >
                <View style={[styles.centerIcon, { backgroundColor: selected ? colors.teal : colors.secondary }]}>
                  <Feather name="home" size={17} color={selected ? colors.accentForeground : colors.primary} />
                </View>
                <View style={styles.centerText}>
                  <Text style={[styles.centerName, { color: colors.foreground }]} numberOfLines={1}>{center.name}</Text>
                  <Text style={[styles.centerAddress, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {center.address}
                  </Text>
                  <Text style={[styles.centerDistance, { color: colors.teal }]}>
                    {formatDistance(distance)} from {myCoords ? "you" : "West Acres"}
                  </Text>
                </View>
                {selected && <Feather name="check-circle" size={18} color={colors.teal} />}
              </Pressable>
              <Pressable
                onPress={() => navigateTo(center)}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${center.name}`}
                style={styles.navigateButton}
              >
                <Feather name="navigation" size={17} color={colors.primary} />
                <Text style={[styles.navigateText, { color: colors.primary }]}>Navigate</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WebViewMap({
  source,
  webViewRef,
  onSelect,
}: {
  source: string;
  webViewRef: React.MutableRefObject<any>;
  onSelect: (id: string) => void;
}) {
  const NativeWebView = require("react-native-webview").WebView;
  return (
    <NativeWebView
      ref={webViewRef}
      source={{ html: source }}
      style={StyleSheet.absoluteFill}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      onMessage={(event: any) => {
        try {
          const payload = JSON.parse(event.nativeEvent.data);
          if (payload.type === "SELECT_CENTER") onSelect(payload.id);
        } catch {}
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  mapFrame: { height: 230, borderRadius: 13, overflow: "hidden", backgroundColor: "#E0F2FE" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  centerList: { gap: 8 },
  centerRow: { borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },
  centerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, padding: 9 },
  centerIcon: { width: 35, height: 35, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  centerText: { flex: 1, gap: 2 },
  centerName: { fontSize: 12, fontFamily: "Inter_700Bold" },
  centerAddress: { fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular" },
  centerDistance: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  navigateButton: { width: 72, alignItems: "center", justifyContent: "center", gap: 3, borderLeftWidth: 1, borderLeftColor: "#E2E8F0" },
  navigateText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});