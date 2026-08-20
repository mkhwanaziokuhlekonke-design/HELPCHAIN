import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { DonationDestination } from "@/context/DonationContext";
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

let WebView: any = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

type NearbyPlace = DonationDestination & { distanceKm: number };
type MapPlace = NearbyPlace & { typeLabel: string; distanceLabel: string };

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

function makeAddress(tags: Record<string, string>) {
  return [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:suburb"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
  ]
    .filter(Boolean)
    .join(", ");
}

function classifyPlace(tags: Record<string, string>): DonationDestination["type"] | null {
  const amenity = tags.amenity ?? "";
  const name = tags.name?.toLowerCase() ?? "";
  const isChurch =
    (amenity === "place_of_worship" &&
      (tags.religion === "christian" || /church|chapel|parish|cathedral/.test(name))) ||
    /church|chapel|parish|cathedral/.test(name);

  if (isChurch) return "church";
  if (
    amenity === "community_centre" ||
    amenity === "social_facility" ||
    amenity === "food_bank" ||
    tags.office === "charity" ||
    /community\s*(centre|center)|food bank|charity|donation/.test(name)
  ) {
    return "center";
  }
  return null;
}

function mapHtml(
  origin: { latitude: number; longitude: number },
  places: MapPlace[],
  selectedId?: string
) {
  const safePlaces = JSON.stringify(places);
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;width:100%;height:100%;font-family:Arial,sans-serif}
  .me{width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 1px 6px rgba(37,99,235,.7)}
  .place{width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;border:2px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)}
  .center{background:#0D9488}.church{background:#7C3AED}.selected{outline:4px solid rgba(20,184,166,.3)}
  .leaflet-popup-content{margin:10px 12px;font-size:12px}.leaflet-popup-content b{font-size:13px}
</style></head><body><div id="map"></div><script>
  var origin=[${origin.latitude},${origin.longitude}];
  var places=${safePlaces};
  var selectedId=${JSON.stringify(selectedId ?? "")};
  var map=L.map('map',{zoomControl:false,attributionControl:false}).setView(origin,13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  L.control.zoom({position:'topright'}).addTo(map);
  L.marker(origin,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]})})
    .addTo(map).bindPopup('<b>You are here</b>');
  var bounds=L.latLngBounds([origin]);
  function sendSelection(id){
    var payload=JSON.stringify({type:'SELECT_DESTINATION',id:id});
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(payload);
    else window.parent.postMessage(payload,'*');
  }
  function safeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[char];
    });
  }
  places.forEach(function(place){
    var isSelected=place.id===selectedId;
    var icon=L.divIcon({className:'',html:'<div class="place '+place.type+(isSelected?' selected':'')+'">'+(place.type==='church'?'✚':'⌂')+'</div>',iconSize:[30,30],iconAnchor:[15,15]});
    var marker=L.marker([place.latitude,place.longitude],{icon:icon}).addTo(map)
      .bindPopup('<b>'+safeHtml(place.name)+'</b><br/>'+safeHtml(place.typeLabel)+' · '+safeHtml(place.distanceLabel)+(place.address?'<br/>'+safeHtml(place.address):''));
    marker.on('click',function(){sendSelection(place.id);});
    bounds.extend([place.latitude,place.longitude]);
  });
  if(places.length)map.fitBounds(bounds,{padding:[34,34],maxZoom:14});
  window.addEventListener('message',function(event){try{var data=typeof event.data==='string'?JSON.parse(event.data):event.data;if(data&&data.type==='SELECT_DESTINATION')sendSelection(data.id)}catch(_){}}); 
</script></body></html>`;
}

export function DonationCentersMap({
  selectedDestination,
  onSelectDestination,
}: {
  selectedDestination: DonationDestination | null;
  onSelectDestination: (destination: DonationDestination) => void;
}) {
  const colors = useColors();
  const { myCoords } = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(myCoords);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSearching, setAreaSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(
    myCoords ? null : "Use your location to find nearby donation destinations."
  );

  useEffect(() => {
    if (myCoords) {
      setOrigin(myCoords);
      setMessage(null);
    }
  }, [myCoords]);

  useEffect(() => {
    if (!origin) return;
    const searchOrigin = {
      latitude: origin.latitude,
      longitude: origin.longitude,
    };
    const controller = new AbortController();

    async function findPlaces() {
      setLoading(true);
      setMessage(null);
      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        if (!domain) throw new Error("HelpChain API domain is unavailable");
        const response = await fetch(
          `https://${domain}/api/nearby-donation-destinations?lat=${searchOrigin.latitude}&lng=${searchOrigin.longitude}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Nearby places are unavailable");
        const data = await response.json();
        const unique = new Map<string, NearbyPlace>();

        for (const item of data.elements ?? []) {
          const tags = (item.tags ?? {}) as Record<string, string>;
          const type = classifyPlace(tags);
          const latitude = item.lat ?? item.center?.lat;
          const longitude = item.lon ?? item.center?.lon;
          const name = tags.name ?? tags.operator;
          if (!type || !name || typeof latitude !== "number" || typeof longitude !== "number") continue;

          const id = `osm-${item.type}-${item.id}`;
          unique.set(id, {
            id,
            name,
            type,
            latitude,
            longitude,
            address: makeAddress(tags) || undefined,
            distanceKm: distanceKm(searchOrigin, { latitude, longitude }),
          });
        }

        const nearby = Array.from(unique.values())
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 15);
        setPlaces(nearby);
        if (!nearby.length) {
          setMessage("No churches or community donation points were found within 10 km. Try a different location.");
        }
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setPlaces([]);
          setMessage("Could not load nearby donation destinations. Please check your connection and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    findPlaces();
    return () => controller.abort();
  }, [origin?.latitude, origin?.longitude]);

  const mapSource = useMemo(
    () =>
      origin
        ? mapHtml(
            origin,
            places.map((place) => ({
              ...place,
              typeLabel: place.type === "church" ? "Church" : "Community center",
              distanceLabel: formatDistance(place.distanceKm),
            })),
            selectedDestination?.id
          )
        : "",
    [origin, places, selectedDestination?.id]
  );

  async function useCurrentLocation() {
    setLocationLoading(true);
    setMessage(null);
    try {
      if (Platform.OS === "web") {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 5000,
          })
        );
        setOrigin({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          setMessage("Location permission is needed to show destinations near you.");
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setOrigin({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      }
    } catch {
      setMessage("We could not get your location. Enable location access and try again.");
    } finally {
      setLocationLoading(false);
    }
  }

  async function searchByArea() {
    const query = areaQuery.trim();
    if (!query) {
      setMessage("Enter your suburb, town, or city to search nearby donation destinations.");
      return;
    }

    setAreaSearching(true);
    setMessage(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("Area lookup unavailable");
      const matches = await response.json();
      const match = matches[0];
      const latitude = Number(match?.lat);
      const longitude = Number(match?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setMessage("We could not find that area. Try a nearby suburb, town, or city.");
        return;
      }
      setOrigin({ latitude, longitude });
    } catch {
      setMessage("We could not search that area. Check your connection and try again.");
    } finally {
      setAreaSearching(false);
    }
  }

  function selectById(id: string) {
    const place = places.find((item) => item.id === id);
    if (!place) return;
    const { distanceKm: _distance, ...destination } = place;
    onSelectDestination(destination);
  }

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleMapMessage = (event: MessageEvent) => {
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (payload?.type === "SELECT_DESTINATION" && typeof payload.id === "string") {
          selectById(payload.id);
        }
      } catch {}
    };
    window.addEventListener("message", handleMapMessage);
    return () => window.removeEventListener("message", handleMapMessage);
  }, [places, onSelectDestination]);

  async function navigateTo(place: NearbyPlace) {
    const label = encodeURIComponent(place.name);
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=driving`;
    const nativeUrl =
      Platform.OS === "ios"
        ? `maps://maps.apple.com/?daddr=${place.latitude},${place.longitude}&dirflg=d&q=${label}`
        : Platform.OS === "android"
          ? `google.navigation:q=${place.latitude},${place.longitude}&mode=d`
          : fallbackUrl;

    try {
      const canNavigate = Platform.OS === "web" || (await Linking.canOpenURL(nativeUrl));
      await Linking.openURL(canNavigate ? nativeUrl : fallbackUrl);
    } catch {
      await Linking.openURL(fallbackUrl);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.tealLight }]}>
          <Feather name="map-pin" size={18} color={colors.teal} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>Choose a donation destination</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Churches and community centers near you
          </Text>
        </View>
        <Pressable
          onPress={useCurrentLocation}
          disabled={locationLoading}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          style={styles.locateButton}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="crosshair" size={19} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {origin ? (
        <View style={styles.mapFrame}>
          {Platform.OS === "web" ? (
            <iframe
              ref={iframeRef as any}
              title="Nearby donation destinations"
              srcDoc={mapSource}
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ type: "SELECT_DESTINATION", id: selectedDestination?.id }),
                  "*"
                );
              }}
              style={{ width: "100%", height: "100%", border: "none", display: "block" } as any}
            />
          ) : WebView ? (
            <WebView
              source={{ html: mapSource }}
              style={StyleSheet.absoluteFill}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              onMessage={(event: any) => {
                try {
                  const payload = JSON.parse(event.nativeEvent.data);
                  if (payload.type === "SELECT_DESTINATION") selectById(payload.id);
                } catch {}
              }}
            />
          ) : (
            <View style={styles.mapUnavailable}>
              <Feather name="map" size={24} color={colors.mutedForeground} />
            </View>
          )}
          {loading && (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.mapLoadingText, { color: colors.foreground }]}>Finding donation points…</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.locationPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="map-pin" size={22} color={colors.mutedForeground} />
          <Text style={[styles.locationPromptText, { color: colors.mutedForeground }]}>
            Turn on location to see donation destinations around you.
          </Text>
          <Pressable onPress={useCurrentLocation} style={[styles.enableLocation, { backgroundColor: colors.primary }]}>
            <Text style={styles.enableLocationText}>Use location</Text>
          </Pressable>
          <View style={styles.orDivider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.mutedForeground }]}>or search an area</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.areaSearchRow}>
            <TextInput
              value={areaQuery}
              onChangeText={setAreaQuery}
              onSubmitEditing={searchByArea}
              placeholder="Suburb, town or city"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              style={[styles.areaInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
            />
            <Pressable
              onPress={searchByArea}
              disabled={areaSearching}
              accessibilityRole="button"
              accessibilityLabel="Search area"
              style={[styles.areaSearchButton, { backgroundColor: colors.primary }]}
            >
              {areaSearching ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={17} color="#fff" />}
            </Pressable>
          </View>
        </View>
      )}

      {message && (
        <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      )}

      {selectedDestination && (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.selectedSummary, { backgroundColor: colors.tealLight, borderColor: colors.teal }]}
        >
          <Feather name="check-circle" size={17} color={colors.teal} />
          <Text style={[styles.selectedSummaryText, { color: colors.foreground }]} numberOfLines={1}>
            Selected: {selectedDestination.name}
          </Text>
        </View>
      )}

      {!!places.length && (
        <View style={styles.list}>
          {places.slice(0, 5).map((place) => {
            const selected = selectedDestination?.id === place.id;
            return (
              <View
                key={place.id}
                style={[
                  styles.placeRow,
                  {
                    backgroundColor: selected ? colors.tealLight : colors.card,
                    borderColor: selected ? colors.teal : colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => selectById(place.id)}
                  style={styles.placeSelection}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${place.name}`}
                  accessibilityState={{ selected }}
                  testID={`donation-destination-${place.id}`}
                >
                  <View style={[styles.placeIcon, { backgroundColor: place.type === "church" ? "#F3E8FF" : colors.tealLight }]}>
                    <Feather name={place.type === "church" ? "home" : "users"} size={16} color={place.type === "church" ? "#7C3AED" : colors.teal} />
                  </View>
                  <View style={styles.placeDetails}>
                    <Text style={[styles.placeName, { color: colors.foreground }]} numberOfLines={1}>{place.name}</Text>
                    <Text style={[styles.placeMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {place.type === "church" ? "Church" : "Community center"} · {formatDistance(place.distanceKm)}
                      {place.address ? ` · ${place.address}` : ""}
                    </Text>
                  </View>
                  {selected && <Feather name="check-circle" size={18} color={colors.teal} />}
                </Pressable>
                <Pressable
                  onPress={() => navigateTo(place)}
                  style={styles.navigateButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${place.name}`}
                >
                  <Feather name="navigation" size={18} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  locateButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  mapFrame: { height: 212, borderRadius: 12, overflow: "hidden", backgroundColor: "#E0F2FE" },
  mapUnavailable: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center", gap: 7 },
  mapLoadingText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  locationPrompt: { borderWidth: 1, minHeight: 112, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 13 },
  locationPromptText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 17 },
  enableLocation: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  enableLocationText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  orDivider: { flexDirection: "row", alignItems: "center", gap: 7, width: "100%", marginTop: 2 },
  dividerLine: { height: 1, flex: 1 },
  orText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  areaSearchRow: { flexDirection: "row", width: "100%", gap: 7 },
  areaInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 12, fontFamily: "Inter_400Regular" },
  areaSearchButton: { width: 42, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  message: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  selectedSummary: { minHeight: 38, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10 },
  selectedSummaryText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { gap: 8 },
  placeRow: { borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  placeSelection: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingLeft: 9, paddingVertical: 9 },
  placeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  placeDetails: { flex: 1, gap: 2 },
  placeName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  placeMeta: { fontSize: 10, fontFamily: "Inter_400Regular" },
  navigateButton: { width: 44, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
});