import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  isAdmin: boolean;
  createdAt: string;
  requestsCreated: number;
  helpOffered: number;
}

interface AuthContextType {
  user: User | null;
  allUsers: User[];
  loading: boolean;
  locationGranted: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setLocationGranted: (val: boolean) => void;
  updateUserStats: (userId: string, field: "requestsCreated" | "helpOffered") => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "@helpchain_users";
const CURRENT_USER_KEY = "@helpchain_current_user";
const LOCATION_KEY = "@helpchain_location_granted";

const SEED_USERS: User[] = [
  {
    id: "u0",
    name: "Admin User",
    email: "admin@helpchain.com",
    phone: "+1 555 000 0000",
    password: "admin123",
    isAdmin: true,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    requestsCreated: 2,
    helpOffered: 5,
  },
  {
    id: "u1",
    name: "John Smith",
    email: "john@example.com",
    phone: "+1 555 123 4567",
    password: "password123",
    isAdmin: false,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    requestsCreated: 3,
    helpOffered: 2,
  },
  {
    id: "u2",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555 987 6543",
    password: "password123",
    isAdmin: false,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    requestsCreated: 1,
    helpOffered: 4,
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationGranted, setLocationGrantedState] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      const storedUsers = await AsyncStorage.getItem(USERS_KEY);
      let users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      if (users.length === 0) {
        users = SEED_USERS;
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      setAllUsers(users);

      const currentUserId = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (currentUserId) {
        const found = users.find((u) => u.id === currentUserId);
        if (found) setUser(found);
      }

      const locGranted = await AsyncStorage.getItem(LOCATION_KEY);
      if (locGranted === "true") setLocationGrantedState(true);
    } catch (e) {
      console.error("Auth init error", e);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    const storedUsers = await AsyncStorage.getItem(USERS_KEY);
    const users: User[] = storedUsers ? JSON.parse(storedUsers) : SEED_USERS;
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (found) {
      setUser(found);
      setAllUsers(users);
      await AsyncStorage.setItem(CURRENT_USER_KEY, found.id);
      return true;
    }
    return false;
  }

  async function signup(name: string, email: string, phone: string, password: string): Promise<boolean> {
    const storedUsers = await AsyncStorage.getItem(USERS_KEY);
    const users: User[] = storedUsers ? JSON.parse(storedUsers) : SEED_USERS;
    const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return false;
    const newUser: User = {
      id: "u" + Date.now(),
      name,
      email,
      phone,
      password,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      requestsCreated: 0,
      helpOffered: 0,
    };
    const updated = [...users, newUser];
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
    setAllUsers(updated);
    setUser(newUser);
    await AsyncStorage.setItem(CURRENT_USER_KEY, newUser.id);
    return true;
  }

  async function logout() {
    setUser(null);
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  }

  async function setLocationGranted(val: boolean) {
    setLocationGrantedState(val);
    await AsyncStorage.setItem(LOCATION_KEY, val ? "true" : "false");
  }

  async function updateUserStats(userId: string, field: "requestsCreated" | "helpOffered") {
    const storedUsers = await AsyncStorage.getItem(USERS_KEY);
    const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
    const updated = users.map((u) =>
      u.id === userId ? { ...u, [field]: u[field] + 1 } : u
    );
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
    setAllUsers(updated);
    if (user?.id === userId) {
      setUser((prev) => prev ? { ...prev, [field]: prev[field] + 1 } : prev);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, allUsers, loading, locationGranted, login, signup, logout, setLocationGranted, updateUserStats }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
