import { getApp, getApps, initializeApp } from "firebase/app";
import { FirebaseError } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
// @ts-expect-error Firebase exposes this persistence helper from its React Native entry point only.
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Strip surrounding quotes or spaces accidentally included when pasting env values.
function clean(val: string | undefined): string {
  return (val ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
}

const firebaseConfig = {
  apiKey:            clean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain:        clean(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId:         clean(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket:     clean(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId:             clean(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => String(value).length > 0);

if (!hasFirebaseConfig) {
  console.warn(
    "Firebase config is missing. Add EXPO_PUBLIC_FIREBASE_* values to a .env file before starting the app."
  );
}

const app = hasFirebaseConfig
  ? getApps().some((candidate) => candidate.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

if (app && app.options.projectId !== firebaseConfig.projectId) {
  throw new Error(
    `Firebase app project mismatch: expected ${firebaseConfig.projectId}, received ${app.options.projectId ?? "unknown"}. Restart the app after updating Firebase configuration.`
  );
}

function createAuth() {
  if (!app) return undefined;
  if (Platform.OS === "web") return getAuth(app);

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (
      error instanceof FirebaseError
      && error.code === "auth/already-initialized"
    ) {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = createAuth() as ReturnType<typeof getAuth>;
export const db = app ? getFirestore(app) : (undefined as any);
