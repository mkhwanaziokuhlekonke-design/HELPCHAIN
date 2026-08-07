/**
 * LocationContext — real-time location sharing between all users.
 *
 * • On login: starts watchPosition and writes lat/lng to presence/{uid}
 * • Every position update: patches the existing presence doc (no new doc)
 * • Listens to presence collection → surfaces all users' live locations
 * • Stops tracking on logout / app background
 */
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import * as Location from "expo-location";
import { auth, db } from "@/lib/firebase";

export interface UserLocation {
  uid: string;
  name: string;
  latitude: number;
  longitude: number;
  updatedAt: number; // ms
  isMe: boolean;
}

interface LocationContextType {
  myCoords: { latitude: number; longitude: number } | null;
  userLocations: UserLocation[]; // all users with a known location
  locationError: string | null;
  locationReady: boolean;
}

const LocationContext = createContext<LocationContextType>({
  myCoords: null,
  userLocations: [],
  locationError: null,
  locationReady: false,
});

const STALE_MS = 10 * 60 * 1000; // hide users unseen for > 10 min

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [myUid, setMyUid] = useState<string | null>(null);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const webWatchRef = useRef<number | null>(null);

  // ── write location to Firestore ────────────────────────────────────────
  const pushLocation = useCallback(async (uid: string, lat: number, lng: number) => {
    try {
      await updateDoc(doc(db, "presence", uid), {
        location: { latitude: lat, longitude: lng },
        locationAt: serverTimestamp(),
      });
    } catch { /* silent — presence doc may not exist yet */ }
  }, []);

  // ── start GPS watch ────────────────────────────────────────────────────
  const startWatch = useCallback(async (uid: string) => {
    stopWatch();

    if (Platform.OS === "web") {
      if (!("geolocation" in navigator)) return;
      webWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMyCoords({ latitude, longitude });
          setLocationReady(true);
          pushLocation(uid, latitude, longitude);
        },
        () => setLocationError("Location denied — enable it in browser settings"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
      return;
    }

    // Native
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationError("Location permission denied — enable it in Settings");
      return;
    }

    // Get an immediate fix first
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setMyCoords({ latitude, longitude });
      setLocationReady(true);
      pushLocation(uid, latitude, longitude);
    } catch { /* will come via watch */ }

    // Then watch continuously
    watchSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 15 },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        setMyCoords({ latitude, longitude });
        setLocationReady(true);
        pushLocation(uid, latitude, longitude);
      }
    );
  }, [pushLocation]);

  const stopWatch = useCallback(() => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    if (webWatchRef.current !== null) {
      navigator.geolocation?.clearWatch(webWatchRef.current);
      webWatchRef.current = null;
    }
  }, []);

  // ── auth gate ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setMyUid(fbUser.uid);
        startWatch(fbUser.uid);
      } else {
        setMyUid(null);
        stopWatch();
        setMyCoords(null);
        setLocationReady(false);
        setUserLocations([]);
      }
    });
    return () => { unsub(); stopWatch(); };
  }, [startWatch, stopWatch]);

  // ── pause / resume on app background ──────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (!myUid) return;
      if (state === "active") startWatch(myUid);
      else stopWatch();
    });
    return () => sub.remove();
  }, [myUid, startWatch, stopWatch]);

  // ── listen to all presence docs → extract locations ───────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "presence"),
      (snap) => {
        const now = Date.now();
        const locs: UserLocation[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data.location?.latitude || !data.location?.longitude) return;

          let updatedAt = 0;
          if (data.locationAt?.toMillis) updatedAt = data.locationAt.toMillis();
          else if (typeof data.locationAt === "string") updatedAt = new Date(data.locationAt).getTime();

          if (updatedAt && now - updatedAt > STALE_MS) return; // stale — skip

          locs.push({
            uid: d.id,
            name: data.name ?? "User",
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            updatedAt,
            isMe: d.id === auth.currentUser?.uid,
          });
        });
        setUserLocations(locs);
      },
      () => { /* rules not yet ready */ }
    );
    return () => unsub();
  }, []);

  return (
    <LocationContext.Provider value={{ myCoords, userLocations, locationError, locationReady }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
