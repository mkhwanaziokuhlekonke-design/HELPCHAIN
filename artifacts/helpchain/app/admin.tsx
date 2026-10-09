import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path, Polyline, Line as SvgLine, Text as SvgText, G } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useDonations } from "@/context/DonationContext";
import { DEFAULT_DONATION_INSTRUCTIONS, useDonationInformation } from "@/context/DonationInformationContext";
import { useEmergencyAlerts } from "@/context/EmergencyAlertContext";
import { AppNotification, useNotifications } from "@/context/NotificationContext";
import { useHelp } from "@/context/HelpContext";
import { MAX_ANNOUNCEMENT_IMAGE_LENGTH, useAnnouncements } from "@/context/AnnouncementContext";
import { useCommunityCentres } from "@/context/CommunityCentreContext";
import { useReports } from "@/context/ReportContext";
import { useOrganisations } from "@/context/OrganisationContext";
import { useLocation } from "@/context/LocationContext";
import { AdminActivityMap } from "@/components/AdminActivityMap";
import { AdminUserActivityFeed } from "@/components/AdminUserActivityFeed";
import { DonationManagementPanel } from "@/components/DonationManagementPanel";
import { HelpChainLogo } from "@/components/HelpChainLogo";

const DRAWER_WIDTH = 240;
const BLUE_DARK = "#0F2747";
const BLUE_MID = "#2563EB";
const BLUE_LIGHT = "#2563EB";
const BG = "#F8FAFC";
const CARD = "#FFFFFF";
const ANNOUNCEMENT_SUBMISSION_TIMEOUT_MS = 20_000;

function withAnnouncementSubmissionTimeout<T>(submission: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("announcement-submission-timeout")),
      ANNOUNCEMENT_SUBMISSION_TIMEOUT_MS
    );
    submission.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); }
    );
  });
}

type Section =
  | "dashboard"
  | "updates"
  | "organisations"
  | "centres"
  | "users"
  | "requests"
  | "donations"
  | "reports"
  | "location"
  | "analytics"
  | "settings";

const NAV_ITEMS: { key: Section; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "updates", label: "Community Updates", icon: "megaphone" },
  { key: "organisations", label: "Verified Organisations", icon: "shield-check" },
  { key: "centres", label: "Community Centres", icon: "map-pin" },
  { key: "users", label: "Users", icon: "users" },
  { key: "requests", label: "Requests", icon: "list" },
  { key: "donations", label: "Donations", icon: "gift" },
  { key: "reports", label: "Reports & Complaints", icon: "flag" },
  { key: "location", label: "Location Monitoring", icon: "map-pin" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-2" },
  { key: "settings", label: "Settings", icon: "settings" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getStatusColor(status: string): string {
  if (status === "open") return "#10B981";
  if (status === "accepted") return "#F59E0B";
  if (status === "completed") return "#14B8A6";
  return "#64748B";
}
function getStatusLabel(status: string): string {
  if (status === "open") return "New";
  if (status === "accepted") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildPath(data: number[], w: number, h: number, maxY: number): string {
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / maxY) * (h - 20),
  }));
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${cx} ${pts[i - 1].y}, ${cx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function LineChart({
  width,
  requests,
  donations,
  users,
}: {
  width: number;
  requests: { createdAt: string }[];
  donations: { createdAt: string }[];
  users: { createdAt: string }[];
}) {
  const H = 160;
  const W = width - 40;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const countsByDay = (records: { createdAt: string }[]) =>
    days.map((day) => records.filter((record) => {
      const createdAt = new Date(record.createdAt);
      return !Number.isNaN(createdAt.getTime()) && createdAt.toDateString() === day.toDateString();
    }).length);
  const requestCounts = countsByDay(requests);
  const donationCounts = countsByDay(donations);
  const userCounts = countsByDay(users);
  const maxY = Math.max(1, ...requestCounts, ...donationCounts, ...userCounts);
  const rPath = buildPath(requestCounts, W, H, maxY);
  const dPath = buildPath(donationCounts, W, H, maxY);
  const uPath = buildPath(userCounts, W, H, maxY);
  const yLabels = [...new Set([0, Math.ceil(maxY / 2), maxY])];

  return (
    <View style={{ paddingLeft: 8, paddingRight: 4 }}>
      <Svg width={W + 16} height={H + 30}>
        {yLabels.map((val) => {
          const y = H - (val / maxY) * (H - 20) + 2;
          return (
            <G key={val}>
              <SvgLine x1={0} y1={y} x2={W} y2={y} stroke="#DBEAFE" strokeWidth={1} />
              <SvgText x={-2} y={y + 4} fontSize={9} fill="#64748B" textAnchor="end">{val === 0 ? "0" : val >= 1000 ? `${val / 1000}k` : val}</SvgText>
            </G>
          );
        })}
        <Path d={rPath} fill="none" stroke="#2563EB" strokeWidth={2} />
        <Path d={dPath} fill="none" stroke="#14B8A6" strokeWidth={2} />
        <Path d={uPath} fill="none" stroke="#7C3AED" strokeWidth={2} />
        {requestCounts.map((v, i) => (
          <Circle
            key={`r${i}`}
            cx={(i / (requestCounts.length - 1)) * W}
            cy={H - (v / maxY) * (H - 20)}
            r={3}
            fill="#2563EB"
          />
        ))}
        {donationCounts.map((v, i) => (
          <Circle
            key={`d${i}`}
            cx={(i / (donationCounts.length - 1)) * W}
            cy={H - (v / maxY) * (H - 20)}
            r={3}
            fill="#14B8A6"
          />
        ))}
        {userCounts.map((v, i) => (
          <Circle
            key={`u${i}`}
            cx={(i / (userCounts.length - 1)) * W}
            cy={H - (v / maxY) * (H - 20)}
            r={3}
            fill="#7C3AED"
          />
        ))}
        {days.filter((_, i) => i % 2 === 0).map((day, idx) => {
          const actualIdx = idx * 2;
          const x = (actualIdx / (days.length - 1)) * W;
          return (
            <SvgText key={day.toISOString()} x={x} y={H + 18} fontSize={8} fill="#64748B" textAnchor="middle">
              {day.toLocaleDateString([], { weekday: "short" })}
            </SvgText>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 6, paddingLeft: 8 }}>
        {[
          { color: "#2563EB", label: "Requests" },
          { color: "#14B8A6", label: "Donations" },
          { color: "#7C3AED", label: "Users" },
        ].map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 20, height: 3, backgroundColor: s.color, borderRadius: 2 }} />
            <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AdminMapView() {
  const mapUrl = "https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.69,-73.97,40.73&layer=mapnik";
  if (Platform.OS === "web") {
    return (
      <iframe
        src={mapUrl}
        style={{ width: "100%", height: 180, border: "none", borderRadius: 8 } as any}
        title="Live Activity Map"
      />
    );
  }
  return (
    <View style={{ height: 180, backgroundColor: "#DBEAFE", borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 8 }}>
      <Feather name="map" size={36} color="#2563EB" />
      <Text style={{ color: "#2563EB", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Live Activity Map</Text>
      <Text style={{ color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" }}>Showing real-time requests & volunteers</Text>
    </View>
  );
}

function AnnouncementImageControl({
  imageUrl,
  onPick,
  onRemove,
}: {
  imageUrl: string | null;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={onPick}
        accessibilityRole="button"
        style={{ minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#DBEAFE", borderStyle: "dashed", borderRadius: 8, paddingHorizontal: 12 }}
      >
        <Feather name="image" size={16} color={BLUE_LIGHT} />
        <Text style={{ color: BLUE_LIGHT, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
          {imageUrl ? "Change donated-goods photo" : "Add donated-goods photo"}
        </Text>
      </Pressable>
      {imageUrl ? (
        <View style={{ position: "relative" }}>
          <Image source={{ uri: imageUrl }} style={{ width: "100%", height: 180, borderRadius: 8, backgroundColor: "#F8FAFC" }} resizeMode="cover" />
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove update photo"
            style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="x" size={16} color="#64748B" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ section?: string; donationId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, allUsers, allUsersLoading, allUsersError, loading, logout, toggleAdminRole, suspendUser, deleteUserFromFirestore } = useAuth();
  const { requests, loading: requestsLoading } = useHelp();
  const { donations, totalItems, loading: donationsLoading, error: donationsError, authorizeCentreReceiver } = useDonations();
  const { instructions: savedDonationInstructions, loading: donationInfoLoading, saveInstructions } = useDonationInformation();
  const { announcements, loading: announcementsLoading, error: announcementsError, createAnnouncement, updateAnnouncement, deleteAnnouncement } = useAnnouncements();
  const { organisations, createOrganisation, updateOrganisation, deleteOrganisation } = useOrganisations();
  const { centres, loading: centresLoading, createCentre, updateCentre, deleteCentre } = useCommunityCentres();
  const { reports, loading: reportsLoading, resolveReport } = useReports();
  const { userLocations } = useLocation();
  const { emergencyAlerts } = useEmergencyAlerts();
  const { notifications, unreadCount, markRead } = useNotifications();

  const [section, setSection] = useState<Section>("dashboard");
  const [selectedDonationId, setSelectedDonationId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [systemSummaryVisible, setSystemSummaryVisible] = useState(false);
  const [now, setNow] = useState(new Date());
  const [userSearch, setUserSearch] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementImage, setAnnouncementImage] = useState<string | null>(null);
  const [announcementCategory, setAnnouncementCategory] = useState<"general" | "update" | "event" | "emergency">("general");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementActionError, setAnnouncementActionError] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", type: "Police station", location: "", contact: "", description: "" });
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [centreForm, setCentreForm] = useState({ name: "", address: "", contact: "", openingHours: "", description: "" });
  const [editingCentreId, setEditingCentreId] = useState<string | null>(null);
  const [donationInstructions, setDonationInstructions] = useState(DEFAULT_DONATION_INSTRUCTIONS);
  const [savingDonationInstructions, setSavingDonationInstructions] = useState(false);
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // ── Admin route guard ────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/portal" as any);
    }
  }, [user, loading]);

  useEffect(() => {
    if (routeParams.section === "donations" || routeParams.section === "updates") {
      setSection(routeParams.section);
    }
    if (routeParams.donationId) setSelectedDonationId(routeParams.donationId);
  }, [routeParams.section, routeParams.donationId]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (savedDonationInstructions) setDonationInstructions(savedDonationInstructions);
  }, [savedDonationInstructions]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerX, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [drawerX, overlayOpacity]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerX, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  }, [drawerX, overlayOpacity]);

  const navTo = useCallback(
    (s: Section) => {
      setSection(s);
      closeDrawer();
    },
    [closeDrawer]
  );

  // ── Guard render ─────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={BLUE_LIGHT} />
      </View>
    );
  }
  if (!user.isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <Feather name="shield-off" size={48} color="#EF4444" />
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E3A5F", textAlign: "center" }}>
          Access Denied
        </Text>
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" }}>
          You need admin privileges to access this dashboard.
        </Text>
        <Pressable
          onPress={() => router.replace("/(tabs)" as any)}
          style={{ backgroundColor: BLUE_LIGHT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 }}
        >
          <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 56 : insets.top;

  const activeRequests = requests.filter((r) => r.status === "open" || r.status === "accepted").length;
  const completedRequests = requests.filter((r) => r.status === "completed").length;
  const selectedDonation = donations.find((donation) => donation.id === selectedDonationId || donation.donationId === selectedDonationId);
  const pendingReports = reports.filter((report) => report.status === "pending");
  const userCountValue = allUsersLoading ? "..." : allUsersError ? "N/A" : String(allUsers.length);
  const systemSummary = [
    { label: "Registered Users", val: userCountValue },
    { label: "Authorised Admins", val: String(allUsers.filter((u) => u.isAdmin).length) },
    { label: "Total Help Requests", val: String(requests.length) },
    { label: "Active Help Requests", val: String(requests.filter((r) => r.status === "open" || r.status === "accepted").length) },
    { label: "Donation Contributions", val: String(donations.length) },
    { label: "Items Donated", val: String(totalItems) },
    { label: "Registered Community Centres", val: String(centres.length) },
    { label: "Official Updates", val: String(announcements.length) },
  ];

  const STATS = [
    { label: "Total Users", val: userCountValue, icon: "user", iconBg: "#2563EB", iconFg: "#FFFFFF" },
    { label: "Active Requests", val: requestsLoading ? "..." : activeRequests.toString(), icon: "activity", iconBg: "#10B981", iconFg: "#FFFFFF" },
    { label: "Completed", val: requestsLoading ? "..." : completedRequests.toString(), icon: "check-circle", iconBg: "#7C3AED", iconFg: "#FFFFFF" },
    { label: "Items Donated", val: donationsLoading ? "..." : totalItems.toString(), icon: "gift", iconBg: "#F59E0B", iconFg: "#FFFFFF" },
    { label: "Active Centres", val: centresLoading ? "..." : centres.length.toString(), icon: "map-pin", iconBg: "#7C3AED", iconFg: "#FFFFFF" },
    { label: "Pending Reports", val: reportsLoading ? "..." : pendingReports.length.toString(), icon: "alert-circle", iconBg: "#EF4444", iconFg: "#FFFFFF" },
  ];

  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  async function handlePickAnnouncementImage() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow access to your photo library to attach an update image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        quality: 0.35,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Image unavailable", "Could not read the selected image. Please choose another photo.");
        return;
      }
      if (asset.base64.length > MAX_ANNOUNCEMENT_IMAGE_LENGTH) {
        Alert.alert("Photo too large", "Choose a smaller or more tightly cropped photo.");
        return;
      }

      setAnnouncementImage(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
    } catch (error: any) {
      Alert.alert("Image unavailable", error?.message ?? "Could not open the photo library.");
    }
  }

  async function handleCreateAnnouncement() {
    setAnnouncementActionError(null);
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      setAnnouncementActionError("Add both a title and a message before posting.");
      return;
    }

    try {
      setPostingAnnouncement(true);
      if (editingAnnouncementId) {
        await withAnnouncementSubmissionTimeout(updateAnnouncement(editingAnnouncementId, {
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          imageUrl: announcementImage,
          category: announcementCategory,
        }));
        Alert.alert("Updated", "The community update has been revised.");
      } else {
        await withAnnouncementSubmissionTimeout(createAnnouncement({
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          imageUrl: announcementImage ?? undefined,
          category: announcementCategory,
        }));
        Alert.alert("Posted", "Your app update is now visible to users.");
      }
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementImage(null);
      setAnnouncementCategory("general");
      setEditingAnnouncementId(null);
    } catch (error: any) {
      const code = typeof error?.code === "string" ? ` (${error.code})` : "";
      const message = error?.message === "announcement-submission-timeout"
        ? "The save timed out. Check the updates list before trying again."
        : error?.message ?? "Unknown Firebase error.";
      setAnnouncementActionError(`Could not save the update${code}: ${message}`);
    } finally {
      setPostingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    Alert.alert("Delete update", "This official update will be removed from the app.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAnnouncement(id);
          } catch (error: any) {
            const code = typeof error?.code === "string" ? ` (${error.code})` : "";
            setAnnouncementActionError(`Could not delete the update${code}: ${error?.message ?? "Unknown Firebase error."}`);
          }
        },
      },
    ]);
  }

  function resetAnnouncementForm() {
    setAnnouncementTitle("");
    setAnnouncementBody("");
    setAnnouncementImage(null);
    setAnnouncementCategory("general");
    setEditingAnnouncementId(null);
    setAnnouncementActionError(null);
  }

  function openAdminNotification(notification: AppNotification) {
    void markRead(notification.id);
    if (notification.donationId) {
      setSelectedDonationId(notification.donationId);
      setSection("donations");
    } else if (notification.announcementId || notification.type === "community_update") {
      setSection("updates");
    } else if (notification.requestId) {
      setSection("requests");
    } else if (notification.type === "new_message") {
      router.push("/(tabs)/chat" as any);
    } else {
      router.push("/(tabs)/notifications" as any);
    }
  }

  async function handleSaveOrganisation() {
    if (!orgForm.name || !orgForm.type || !orgForm.location || !orgForm.contact || !orgForm.description) {
      Alert.alert("Missing fields", "Complete every organisation field before saving.");
      return;
    }

    try {
      if (editingOrgId) {
        await updateOrganisation(editingOrgId, orgForm);
      } else {
        await createOrganisation(orgForm);
      }
      setOrgForm({ name: "", type: "Police station", location: "", contact: "", description: "" });
      setEditingOrgId(null);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    }
  }

  async function handleDeleteOrganisation(id: string) {
    Alert.alert("Remove organisation", "This verified organisation will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteOrganisation(id);
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Please try again.");
          }
        },
      },
    ]);
  }

  async function handleSaveCentre() {
    if (!centreForm.name || !centreForm.address || !centreForm.contact || !centreForm.openingHours || !centreForm.description) {
      Alert.alert("Missing fields", "Complete every centre detail before saving.");
      return;
    }

    try {
      if (editingCentreId) {
        await updateCentre(editingCentreId, centreForm);
      } else {
        await createCentre(centreForm);
      }
      setCentreForm({ name: "", address: "", contact: "", openingHours: "", description: "" });
      setEditingCentreId(null);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    }
  }

  async function handleDeleteCentre(id: string) {
    Alert.alert("Remove centre", "This community centre will be removed from the safe donation list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCentre(id);
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Please try again.");
          }
        },
      },
    ]);
  }

  async function handleSaveDonationInstructions() {
    try {
      setSavingDonationInstructions(true);
      await saveInstructions(donationInstructions);
      Alert.alert("Saved", "Donation information is now visible to users.");
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    } finally {
      setSavingDonationInstructions(false);
    }
  }

  async function handleAdminLogout() {
    try {
      await logout();
      router.replace("/(auth)/portal" as any);
    } catch (error) {
      console.error("[Admin] sign out failed:", error);
      Alert.alert("Sign Out Failed", "Could not sign out. Please try again.");
    }
  }

  async function handleResolveReport(reportId: string) {
    try {
      await resolveReport(reportId);
    } catch {
      Alert.alert("Could not update report", "Please check your connection and try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── TOP HEADER ── */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: CARD }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={openDrawer} style={styles.iconBtn}>
            <Feather name="menu" size={22} color="#1E3A5F" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSub}>Welcome back, {user?.name ?? "Admin"}!</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => {
                setSection("users");
                setUserSearch("");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open user search"
              style={styles.iconBtn}
            >
              <Feather name="search" size={20} color="#64748B" />
            </Pressable>
            <Pressable onPress={() => router.push("/(tabs)/notifications" as any)} style={[styles.iconBtn, { position: "relative" }]}>
              <Feather name="bell" size={20} color="#64748B" />
              {unreadCount > 0 && <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>}
            </Pressable>
            <View style={styles.dateBox}>
              <Feather name="calendar" size={12} color="#64748B" />
              <Text style={styles.dateText}>{dateStr} | {timeStr}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── MAIN CONTENT ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }}>
        {/* STATS ROW */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
        >
          {STATS.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => {
                const target: Record<string, Section> = {
                  "Total Users": "users",
                  "Active Requests": "requests",
                  Completed: "requests",
                  "Items Donated": "donations",
                  "Active Centres": "centres",
                  "Pending Reports": "reports",
                };
                navTo(target[s.label]);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open ${s.label}`}
              style={({ pressed }) => [styles.statCard, { backgroundColor: CARD, opacity: pressed ? 0.82 : 1 }]}
            >
              <View style={[styles.statIconCircle, { backgroundColor: s.iconBg }]}>
                <Feather name={s.icon as any} size={18} color={s.iconFg} />
              </View>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <View style={styles.statTrend}>
                <Text style={[styles.statTrendText, { color: "#64748B" }]}>
                  {s.label === "Total Users"
                    ? allUsersLoading ? "Loading from Firebase" : allUsersError ? "Unavailable" : "Live from Firebase"
                    : "Current total"}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
          {!!allUsersError && (
            <Text style={{ marginHorizontal: 16, marginTop: 8, color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>
              {allUsersError}
            </Text>
          )}
          {!!donationsError && (
            <Text accessibilityRole="alert" style={{ marginHorizontal: 16, marginTop: 8, color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>
              {donationsError}
            </Text>
          )}

        {section === "dashboard" && (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={[styles.card, { gap: 12 }]}> 
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Post to app</Text>
                <Text style={styles.cardTitleSub}>{announcements.length} live</Text>
              </View>
              {!!announcementActionError && <Text accessibilityRole="alert" style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>{announcementActionError}</Text>}
              {!!announcementsError && <Text accessibilityRole="alert" style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>{announcementsError}</Text>}

              <TextInput
                value={announcementTitle}
                onChangeText={setAnnouncementTitle}
                placeholder="Announcement title"
                placeholderTextColor="#64748B"
                style={{
                  borderWidth: 1,
                  borderColor: "#DBEAFE",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 13,
                  color: "#1E3A5F",
                  fontFamily: "Inter_500Medium",
                  backgroundColor: "#F8FAFC",
                }}
              />

              <TextInput
                value={announcementBody}
                onChangeText={setAnnouncementBody}
                placeholder="Write the update or message for users..."
                multiline
                numberOfLines={4}
                placeholderTextColor="#64748B"
                style={{
                  borderWidth: 1,
                  borderColor: "#DBEAFE",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 96,
                  textAlignVertical: "top",
                  fontSize: 13,
                  color: "#1E3A5F",
                  fontFamily: "Inter_400Regular",
                  backgroundColor: "#F8FAFC",
                }}
              />

              <AnnouncementImageControl
                imageUrl={announcementImage}
                onPick={handlePickAnnouncementImage}
                onRemove={() => setAnnouncementImage(null)}
              />

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {(["general", "update", "event", "emergency"] as const).map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => setAnnouncementCategory(category)}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: announcementCategory === category ? "#DBEAFE" : "#F8FAFC",
                    }}
                  >
                    <Text style={{
                      fontSize: 11,
                      color: announcementCategory === category ? "#2563EB" : "#64748B",
                      fontFamily: "Inter_600SemiBold",
                      textTransform: "capitalize",
                    }}>
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleCreateAnnouncement}
                disabled={postingAnnouncement}
                style={{
                  backgroundColor: postingAnnouncement ? "#EFF6FF" : BLUE_LIGHT,
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {postingAnnouncement ? "Posting..." : "Post to app"}
                </Text>
              </Pressable>
            </View>

            {/* OVERVIEW CHART */}
            <Pressable
            onPress={() => navTo("analytics")}
            accessibilityRole="button"
            accessibilityLabel="Open activity analytics"
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.88 : 1 }]}
            >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Activity <Text style={styles.cardTitleSub}>(Last 7 Days)</Text></Text>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>Live data</Text>
              </View>
            </View>
            <LineChart width={width - 28} requests={requests} donations={donations} users={allUsers} />
            </Pressable>

            {/* LIVE MAP */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Pressable
                  onPress={() => navTo("location")}
                  accessibilityRole="button"
                  accessibilityLabel="Open location monitoring"
                  style={{ flex: 1 }}
                >
                  <Text style={styles.cardTitle}>Live Activity Map</Text>
                </Pressable>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>All Activities</Text>
                  <Feather name="chevron-down" size={12} color="#64748B" />
                </View>
              </View>
              <AdminMapView />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {[
                  { color: "#2563EB", label: "Active Requests" },
                  { color: "#10B981", label: "Donations" },
                  { color: "#7C3AED", label: "Volunteers" },
                  { color: "#F59E0B", label: "Community Groups" },
                ].map((l) => (
                  <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
                    <Text style={{ fontSize: 10, color: "#64748B", fontFamily: "Inter_400Regular" }}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* RECENT DONATIONS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Donations</Text>
                <Pressable onPress={() => setSection("donations")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              {donations.slice(0, 4).map((d) => (
                <Pressable key={d.id} onPress={() => { setSelectedDonationId(d.id); setSection("donations"); }} style={styles.donationRow}>
                  <View style={[styles.donationIcon, { backgroundColor: "#F8FAFC" }]}>
                    <Feather name="gift" size={16} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.donationTitle} numberOfLines={1}>{d.quantity}× {d.itemType}</Text>
                    <Text style={styles.donationBy} numberOfLines={1}>{d.destination?.name ?? "Centre unavailable"} · {d.donorName}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.donationAmt}>{d.quantity} items</Text>
                    <Text style={styles.donationTime}>{timeAgo(d.createdAt)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Community Updates</Text>
                <Pressable onPress={() => setSection("updates")}><Text style={styles.viewAll}>View All</Text></Pressable>
              </View>
              {announcements.slice(0, 3).map((item) => (
                <Pressable key={item.id} onPress={() => setSection("updates")} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }}>
                  <Text style={styles.donationTitle}>{item.title}</Text>
                  <Text style={styles.donationBy} numberOfLines={2}>{item.body}</Text>
                  <Text style={styles.donationTime}>{timeAgo(item.createdAt)}</Text>
                </Pressable>
              ))}
              {announcements.length === 0 && <Text style={styles.requestLoc}>No published updates yet.</Text>}
            </View>

            <AdminUserActivityFeed />

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Notifications</Text>
                <Pressable onPress={() => router.push("/(tabs)/notifications" as any)}><Text style={styles.viewAll}>View All</Text></Pressable>
              </View>
              {notifications.slice(0, 5).map((notification) => (
                <Pressable key={notification.id} onPress={() => openAdminNotification(notification)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {!notification.read && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE_LIGHT }} />}
                    <Text style={styles.donationTitle}>{notification.title}</Text>
                    <Text style={[styles.donationTime, { marginLeft: "auto" as any }]}>{timeAgo(notification.createdAt)}</Text>
                  </View>
                  <Text style={styles.donationBy} numberOfLines={2}>{notification.body}</Text>
                </Pressable>
              ))}
              {notifications.length === 0 && <Text style={styles.requestLoc}>No notifications yet.</Text>}
            </View>

            {/* PENDING REPORTS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Pending Reports</Text>
                <Pressable onPress={() => setSection("reports")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              {reportsLoading ? (
                <ActivityIndicator color={BLUE_LIGHT} />
              ) : pendingReports.length ? pendingReports.slice(0, 4).map((report) => (
                <View key={report.id} style={styles.reportRow}>
                  <View style={[styles.reportFlag, { backgroundColor: "#F8FAFC" }]}>
                    <Feather name="flag" size={14} color="#EF4444" />
                  </View>
                  <Pressable
                    onPress={() => navTo("reports")}
                    accessibilityRole="button"
                    style={{ flex: 1 }}
                  >
                    <Text style={styles.reportTitle}>{report.reason}</Text>
                    <Text style={styles.reportDesc}>{report.requestTitle} · {report.reporterName}</Text>
                  </Pressable>
                  <Text style={styles.reportTime}>{timeAgo(report.createdAt)}</Text>
                  <Pressable onPress={() => handleResolveReport(report.id)} style={styles.reportResolveButton}>
                    <Text style={styles.reportResolveText}>Resolve</Text>
                  </Pressable>
                </View>
              )) : <Text style={styles.reportDesc}>No pending reports.</Text>}
            </View>

            {/* SYSTEM SUMMARY */}
            <View style={styles.card}>
              <Pressable
                onPress={() => setSystemSummaryVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="View full system summary"
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}
              >
                <Text style={styles.cardTitle}>System Summary</Text>
                <Text style={styles.viewAll}>View details</Text>
              </Pressable>
              {systemSummary.map((summary, i) => (
                <Pressable
                  key={summary.label}
                  onPress={() => {
                    const target: Record<string, Section> = {
                      "Registered Users": "users",
                      "Authorised Admins": "users",
                      "Total Help Requests": "requests",
                      "Active Help Requests": "requests",
                      "Donation Contributions": "donations",
                      "Items Donated": "donations",
                      "Registered Community Centres": "centres",
                      "Official Updates": "updates",
                    };
                    navTo(target[summary.label]);
                  }}
                  accessibilityRole="button"
                  style={[styles.summaryRow, i < systemSummary.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }]}
                >
                  <Text style={styles.summaryLabel}>{summary.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={styles.summaryVal}>{summary.val}</Text>
                    <Feather name="chevron-right" size={14} color="#DBEAFE" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {section === "updates" && (
          <View style={{ padding: 14, gap: 12 }}>
            <View style={[styles.card, { gap: 12 }]}> 
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{editingAnnouncementId ? "Edit official update" : "Create official update"}</Text>
                {editingAnnouncementId && (
                  <Pressable onPress={resetAnnouncementForm}>
                    <Text style={styles.viewAll}>Cancel</Text>
                  </Pressable>
                )}
              </View>
              {!!announcementActionError && <Text accessibilityRole="alert" style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>{announcementActionError}</Text>}

              <TextInput value={announcementTitle} onChangeText={setAnnouncementTitle} placeholder="Update title" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={announcementBody} onChangeText={setAnnouncementBody} multiline numberOfLines={5} placeholder="Write the community update for all users..." style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, minHeight:110, textAlignVertical:"top", fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />

              <AnnouncementImageControl
                imageUrl={announcementImage}
                onPick={handlePickAnnouncementImage}
                onRemove={() => setAnnouncementImage(null)}
              />

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["general", "update", "event", "emergency"] as const).map((category) => (
                  <Pressable key={category} onPress={() => setAnnouncementCategory(category)} style={{ borderRadius:999, paddingHorizontal:10, paddingVertical:6, backgroundColor: announcementCategory === category ? "#DBEAFE" : "#F8FAFC" }}>
                    <Text style={{ fontSize:11, color: announcementCategory === category ? "#2563EB" : "#64748B", fontFamily: "Inter_600SemiBold", textTransform: "capitalize" }}>{category}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={handleCreateAnnouncement} disabled={postingAnnouncement} style={{ backgroundColor: postingAnnouncement ? "#EFF6FF" : BLUE_LIGHT, borderRadius:12, paddingVertical:12, alignItems:"center" }}>
                <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize:13 }}>{postingAnnouncement ? (editingAnnouncementId ? "Saving..." : "Publishing...") : (editingAnnouncementId ? "Save update" : "Publish update")}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionHeader}>{announcements.length} OFFICIAL UPDATES</Text>
            {announcementsLoading && <ActivityIndicator color={BLUE_LIGHT} />}
            {!!announcementsError && (
              <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>{announcementsError}</Text>
            )}
            {announcements.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <View style={{ backgroundColor: "#EFF6FF", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 10, color: "#0F2747", fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>{item.category}</Text>
                  </View>
                  <Text style={styles.donationTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={[styles.requestName, { marginTop: 10 }]}>{item.title}</Text>
                <Text style={[styles.requestLoc, { marginTop: 6 }]}>{item.body}</Text>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 180, marginTop: 10, borderRadius: 8, backgroundColor: "#F8FAFC" }} resizeMode="cover" />
                ) : null}
                <Text style={[styles.requestLoc, { marginTop: 8, color: "#64748B" }]}>By {item.createdByName}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable onPress={() => { setEditingAnnouncementId(item.id); setAnnouncementTitle(item.title); setAnnouncementBody(item.body); setAnnouncementImage(item.imageUrl ?? null); setAnnouncementCategory(item.category); }} style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteAnnouncement(item.id)} style={{ backgroundColor: "#F8FAFC", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {section === "organisations" && (
          <View style={{ padding: 14, gap: 12 }}>
            <View style={[styles.card, { gap: 10 }]}> 
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{editingOrgId ? "Edit organisation" : "Add verified organisation"}</Text>
                {editingOrgId && (
                  <Pressable onPress={() => { setEditingOrgId(null); setOrgForm({ name: "", type: "Police station", location: "", contact: "", description: "" }); }}>
                    <Text style={styles.viewAll}>Cancel</Text>
                  </Pressable>
                )}
              </View>

              <TextInput value={orgForm.name} onChangeText={(value) => setOrgForm((prev) => ({ ...prev, name: value }))} placeholder="Organisation name" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={orgForm.type} onChangeText={(value) => setOrgForm((prev) => ({ ...prev, type: value }))} placeholder="Type (Police station, NGO, Municipality...)" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={orgForm.location} onChangeText={(value) => setOrgForm((prev) => ({ ...prev, location: value }))} placeholder="Location / address" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={orgForm.contact} onChangeText={(value) => setOrgForm((prev) => ({ ...prev, contact: value }))} placeholder="Contact details" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={orgForm.description} onChangeText={(value) => setOrgForm((prev) => ({ ...prev, description: value }))} multiline placeholder="Description" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, minHeight:90, textAlignVertical:"top", fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />

              <Pressable onPress={handleSaveOrganisation} style={{ backgroundColor: BLUE_LIGHT, borderRadius:12, paddingVertical:12, alignItems:"center" }}>
                <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize:13 }}>{editingOrgId ? "Save organisation" : "Add organisation"}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionHeader}>{organisations.length} VERIFIED ORGANISATIONS</Text>
            {organisations.map((org) => (
              <View key={org.id} style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex:1 }}>
                    <Text style={styles.requestName}>{org.name}</Text>
                    <Text style={[styles.requestLoc, { marginTop: 2, color: BLUE_LIGHT }]}>{org.type}</Text>
                  </View>
                  <View style={{ backgroundColor: "#EFF6FF", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 10, color: "#0F2747", fontFamily: "Inter_700Bold" }}>Verified</Text>
                  </View>
                </View>
                <Text style={[styles.requestLoc, { marginTop: 8 }]}>{org.location}</Text>
                <Text style={[styles.requestLoc, { marginTop: 4 }]}>{org.contact}</Text>
                <Text style={[styles.requestLoc, { marginTop: 8 }]}>{org.description}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable onPress={() => { setEditingOrgId(org.id); setOrgForm({ name: org.name, type: org.type, location: org.location, contact: org.contact, description: org.description }); }} style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteOrganisation(org.id)} style={{ backgroundColor: "#F8FAFC", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {section === "centres" && (
          <View style={{ padding: 14, gap: 12 }}>
            <View style={[styles.card, { gap: 10 }]}> 
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{editingCentreId ? "Edit centre" : "Add community centre"}</Text>
                {editingCentreId && (
                  <Pressable onPress={() => { setEditingCentreId(null); setCentreForm({ name: "", address: "", contact: "", openingHours: "", description: "" }); }}>
                    <Text style={styles.viewAll}>Cancel</Text>
                  </Pressable>
                )}
              </View>

              <TextInput value={centreForm.name} onChangeText={(value) => setCentreForm((prev) => ({ ...prev, name: value }))} placeholder="Centre name" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={centreForm.address} onChangeText={(value) => setCentreForm((prev) => ({ ...prev, address: value }))} placeholder="Address / location" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={centreForm.contact} onChangeText={(value) => setCentreForm((prev) => ({ ...prev, contact: value }))} placeholder="Contact information" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={centreForm.openingHours} onChangeText={(value) => setCentreForm((prev) => ({ ...prev, openingHours: value }))} placeholder="Opening hours" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />
              <TextInput value={centreForm.description} onChangeText={(value) => setCentreForm((prev) => ({ ...prev, description: value }))} multiline placeholder="Description" style={{ borderWidth:1, borderColor:"#DBEAFE", borderRadius:10, paddingHorizontal:12, paddingVertical:10, minHeight:90, textAlignVertical:"top", fontSize:13, color:"#1E3A5F", backgroundColor:"#F8FAFC" }} />

              <Pressable onPress={handleSaveCentre} style={{ backgroundColor: BLUE_LIGHT, borderRadius:12, paddingVertical:12, alignItems:"center" }}>
                <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize:13 }}>{editingCentreId ? "Save centre" : "Add centre"}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionHeader}>{centres.length} SAFE COMMUNITY CENTRES</Text>
            {centres.map((centre) => (
              <View key={centre.id} style={styles.card}>
                <Text style={styles.requestName}>{centre.name}</Text>
                <Text style={[styles.requestLoc, { marginTop: 8 }]}>{centre.address}</Text>
                <Text style={[styles.requestLoc, { marginTop: 4 }]}>{centre.contact}</Text>
                <Text style={[styles.requestLoc, { marginTop: 4 }]}>{centre.openingHours}</Text>
                <Text style={[styles.requestLoc, { marginTop: 8 }]}>{centre.description}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable onPress={() => { setEditingCentreId(centre.id); setCentreForm({ name: centre.name, address: centre.address, contact: centre.contact ?? "", openingHours: centre.openingHours, description: centre.description }); }} style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteCentre(centre.id)} style={{ backgroundColor: "#F8FAFC", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {section === "users" && (() => {
          const filtered = allUsers.filter(
            (u) =>
              u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
              u.email.toLowerCase().includes(userSearch.toLowerCase())
          );

          async function handleToggleAdmin(u: typeof allUsers[0]) {
            if (u.id === user?.id) {
              Alert.alert("Not Allowed", "You cannot change your own admin role.");
              return;
            }
            Alert.alert(
              u.isAdmin ? "Remove Admin" : "Make Admin",
              `${u.isAdmin ? "Remove admin privileges from" : "Grant admin privileges to"} ${u.name}?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: u.isAdmin ? "Remove" : "Promote",
                  style: u.isAdmin ? "destructive" : "default",
                  onPress: async () => {
                    try { await toggleAdminRole(u.id); }
                    catch { Alert.alert("Error", "Failed to update role."); }
                  },
                },
              ]
            );
          }

          async function handleSuspend(u: typeof allUsers[0]) {
            if (u.id === user?.id) {
              Alert.alert("Not Allowed", "You cannot suspend your own account.");
              return;
            }
            const action = u.suspended ? "Unsuspend" : "Suspend";
            Alert.alert(
              `${action} User`,
              `${action} ${u.name}'s access to HelpChain?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: action,
                  style: u.suspended ? "default" : "destructive",
                  onPress: async () => {
                    try { await suspendUser(u.id, !u.suspended); }
                    catch { Alert.alert("Error", "Failed to update user."); }
                  },
                },
              ]
            );
          }

          async function handleDelete(u: typeof allUsers[0]) {
            if (u.id === user?.id) {
              Alert.alert("Not Allowed", "You cannot delete your own account here.");
              return;
            }
            Alert.alert(
              "Delete User",
              `Permanently remove ${u.name} from HelpChain? This cannot be undone.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try { await deleteUserFromFirestore(u.id); }
                    catch { Alert.alert("Error", "Failed to delete user."); }
                  },
                },
              ]
            );
          }

          async function handleCentreReceiverRole(u: typeof allUsers[0], centreId: string) {
            const enabled = !(u.authorizedCentreIds ?? []).includes(centreId);
            const centreName = centres.find((centre) => centre.id === centreId)?.name ?? "this centre";
            try {
              await authorizeCentreReceiver(u.id, centreId, enabled);
              Alert.alert("Receiver access updated", `${u.name} ${enabled ? "can now" : "can no longer"} confirm donations at ${centreName}.`);
            } catch (error) {
              Alert.alert("Could not update receiver access", error instanceof Error ? error.message : "Please try again.");
            }
          }

          return (
            <View style={{ padding: 14, gap: 10 }}>
              {/* Search bar */}
              <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }]}>
                <Feather name="search" size={16} color="#64748B" />
                <TextInput
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search users by name or email…"
                  placeholderTextColor="#64748B"
                  style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#1E3A5F" }}
                />
                {userSearch.length > 0 && (
                  <Pressable onPress={() => setUserSearch("")}>
                    <Feather name="x" size={14} color="#64748B" />
                  </Pressable>
                )}
              </View>

              <Text style={styles.sectionHeader}>
                {filtered.length} / {allUsers.length} USERS
              </Text>

              {filtered.map((u) => {
                const isSelf = u.id === user?.id;
                const donatedItems = donations.filter((d) => d.donorId === u.id).reduce((s, d) => s + d.quantity, 0);
                return (
                  <View
                    key={u.id}
                    style={[
                      styles.card,
                      u.suspended && { borderWidth: 1.5, borderColor: "#F8FAFC" },
                    ]}
                  >
                    {/* Top row: avatar + info + badges */}
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                      {/* Avatar */}
                      <View style={[styles.requestAvatar, { width: 48, height: 48, borderRadius: 24, overflow: "hidden" }]}>
                        {u.photoURL ? (
                          <Image source={{ uri: u.photoURL }} style={{ width: 48, height: 48 }} resizeMode="cover" />
                        ) : (
                          <Text style={[styles.requestAvatarText, { fontSize: 18 }]}>{u.name.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>

                      {/* Name + email + badges */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <Text style={styles.requestName}>{u.name}</Text>
                          {isSelf && (
                            <View style={{ backgroundColor: "#ECFDF5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 9, color: "#10B981", fontFamily: "Inter_600SemiBold" }}>You</Text>
                            </View>
                          )}
                          {u.isAdmin && (
                            <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 9, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Admin</Text>
                            </View>
                          )}
                          {u.suspended && (
                            <View style={{ backgroundColor: "#F8FAFC", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 9, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>Suspended</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.requestLoc}>{u.email}</Text>
                        {u.phone ? <Text style={styles.requestLoc}>{u.phone}</Text> : null}
                      </View>
                    </View>

                    {/* Stats row */}
                    <View style={{ flexDirection: "row", gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F8FAFC" }}>
                      <View style={{ alignItems: "center", gap: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: BLUE_LIGHT }}>{u.requestsCreated}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#64748B" }}>Requests</Text>
                      </View>
                      <View style={{ alignItems: "center", gap: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#14B8A6" }}>{u.helpOffered}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#64748B" }}>Helped</Text>
                      </View>
                      <View style={{ alignItems: "center", gap: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>{donatedItems}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#64748B" }}>Donated</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#DBEAFE", alignSelf: "flex-end" }}>
                        Since {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </Text>
                    </View>

                    {/* Action buttons — hidden for self */}
                    {!isSelf && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        {centres.map((centre) => {
                          const assigned = (u.authorizedCentreIds ?? []).includes(centre.id);
                          return (
                            <Pressable
                              key={`receiver-${centre.id}`}
                              onPress={() => handleCentreReceiverRole(u, centre.id)}
                              style={[styles.adminActionBtn, { backgroundColor: assigned ? "#ECFDF5" : "#F8FAFC" }]}
                            >
                              <Feather name="map-pin" size={12} color={assigned ? "#0D9488" : "#64748B"} />
                              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: assigned ? "#0D9488" : "#64748B" }}>
                                {assigned ? "Revoke" : "Authorize"} · {centre.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                        {/* Promote / Demote */}
                        <Pressable
                          onPress={() => handleToggleAdmin(u)}
                          style={({ pressed }) => [
                            styles.adminActionBtn,
                            { backgroundColor: u.isAdmin ? "#F8FAFC" : "#DBEAFE", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Feather name="shield" size={12} color={u.isAdmin ? "#F59E0B" : BLUE_LIGHT} />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: u.isAdmin ? "#F59E0B" : BLUE_LIGHT }}>
                            {u.isAdmin ? "Remove Admin" : "Make Admin"}
                          </Text>
                        </Pressable>

                        {/* Suspend / Unsuspend */}
                        <Pressable
                          onPress={() => handleSuspend(u)}
                          style={({ pressed }) => [
                            styles.adminActionBtn,
                            { backgroundColor: u.suspended ? "#ECFDF5" : "#F8FAFC", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Feather name={u.suspended ? "user-check" : "user-x"} size={12} color={u.suspended ? "#10B981" : "#EF4444"} />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: u.suspended ? "#10B981" : "#EF4444" }}>
                            {u.suspended ? "Unsuspend" : "Suspend"}
                          </Text>
                        </Pressable>

                        {/* Delete */}
                        <Pressable
                          onPress={() => handleDelete(u)}
                          style={({ pressed }) => [
                            styles.adminActionBtn,
                            { backgroundColor: "#F8FAFC", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Feather name="trash-2" size={12} color="#64748B" />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B" }}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              {filtered.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                  <Feather name="users" size={32} color="#DBEAFE" />
                  <Text style={{ color: "#64748B", fontFamily: "Inter_400Regular", fontSize: 14 }}>No users match your search</Text>
                </View>
              )}
            </View>
          );
        })()}

        {section === "requests" && (
          <View style={{ padding: 14, gap: 10 }}>
            <Text style={styles.sectionHeader}>{requests.length} TOTAL REQUESTS</Text>
            {requests.map((req) => (
              <Pressable key={req.id} onPress={() => router.push(`/request/${req.id}` as any)} style={styles.card}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View style={[styles.requestAvatar, { backgroundColor: req.isEmergency ? "#F8FAFC" : "#DBEAFE" }]}>
                    <Text style={[styles.requestAvatarText, { color: req.isEmergency ? "#EF4444" : BLUE_LIGHT }]}>{req.requesterName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName} numberOfLines={1}>{req.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Feather name="map-pin" size={9} color="#64748B" />
                      <Text style={styles.requestLoc}>{req.location?.address ?? "Your City"}</Text>
                    </View>
                    <Text style={[styles.requestLoc, { marginTop: 2 }]}>by {req.requesterName} · {timeAgo(req.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.statusPill, { backgroundColor: getStatusColor(req.status) + "20" }]}>
                      <Text style={[styles.statusPillText, { color: getStatusColor(req.status) }]}>
                        {getStatusLabel(req.status)}
                      </Text>
                    </View>
                    {req.isEmergency && (
                      <View style={[styles.statusPill, { backgroundColor: "#F8FAFC" }]}>
                        <Text style={[styles.statusPillText, { color: "#EF4444" }]}>Emergency</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {section === "donations" && (
          <View style={{ padding: 14, gap: 10 }}>
            <View style={[styles.card, { gap: 10 }]}>
              <Text style={styles.cardTitle}>Official donation information</Text>
              <Text style={styles.requestLoc}>This guidance appears on the user Donation page. Item choices remain non-cash.</Text>
              <TextInput
                value={donationInstructions}
                onChangeText={setDonationInstructions}
                multiline
                maxLength={700}
                placeholder="Describe accepted non-cash items and drop-off guidance"
                style={{ borderWidth: 1, borderColor: "#DBEAFE", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 100, textAlignVertical: "top", fontSize: 13, color: "#1E3A5F", backgroundColor: "#F8FAFC" }}
              />
              <Pressable onPress={handleSaveDonationInstructions} disabled={donationInfoLoading || savingDonationInstructions} style={{ backgroundColor: donationInfoLoading || savingDonationInstructions ? "#EFF6FF" : BLUE_LIGHT, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}>
                <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{savingDonationInstructions ? "Saving..." : "Save donation information"}</Text>
              </Pressable>
            </View>
            <LinearGradient colors={["#14B8A6", "#0D9488"]} style={[styles.donationBanner]}>
              <Feather name="gift" size={28} color="#FFFFFF" />
              <View>
                <Text style={{ color: "#FFFFFF", fontSize: 28, fontFamily: "Inter_700Bold" }}>{totalItems}</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  Total items donated · {donations.length} contributions
                </Text>
              </View>
            </LinearGradient>
            {donationsError ? <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{donationsError}</Text> : null}
            {donationsLoading ? <ActivityIndicator color="#0D9488" /> : null}
            <DonationManagementPanel
              donations={donations}
              selectedDonation={selectedDonation}
              onSelectDonation={setSelectedDonationId}
            />
          </View>
        )}

        {section === "reports" && (
          <View style={{ padding: 14, gap: 10 }}>
            <Text style={styles.sectionHeader}>{pendingReports.length} PENDING REPORTS</Text>
            {reportsLoading ? <ActivityIndicator color={BLUE_LIGHT} /> : pendingReports.length ? pendingReports.map((report) => (
              <View key={report.id} style={[styles.card, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
                <View style={[styles.reportFlag, { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F8FAFC" }]}>
                  <Feather name="flag" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>{report.reason}</Text>
                  <Text style={styles.reportDesc}>{report.requestTitle} · {report.reporterName}</Text>
                  <Text style={styles.reportTime}>{timeAgo(report.createdAt)}</Text>
                </View>
                <Pressable onPress={() => handleResolveReport(report.id)} style={styles.reportResolveButton}>
                  <Text style={styles.reportResolveText}>Resolve</Text>
                </Pressable>
              </View>
            )) : <Text style={styles.reportDesc}>No pending reports.</Text>}
          </View>
        )}

        {section === "location" && (() => {
          // ── Derived live stats ──────────────────────────────────────────
          const onlineCount = userLocations.length;
          const openReqs = requests.filter((r) => r.status === "open" || r.status === "accepted");
          const emergencyReqs = requests.filter((r) => r.isEmergency && r.status !== "completed" && r.status !== "cancelled");
          const geoReqs = requests.filter((r) => r.location && r.status !== "cancelled");
           const activeEmergencyAlerts = emergencyAlerts.length;
           const geolocatedAlerts = emergencyAlerts.filter((alert) => alert.location).length;

          // ── Combined activity feed: requests + donations, newest first ──
          type ActivityItem =
            | { kind: "request"; id: string; title: string; status: string; isEmergency: boolean; category: string; location?: { address?: string }; time: string }
             | { kind: "donation"; id: string; donorName: string; itemType: string; itemIcon: string; quantity: number; time: string }
             | { kind: "emergency"; id: string; userName: string; userPhone?: string; serviceName: string; serviceNumber: string; location?: { address?: string }; time: string };

          const feedItems: ActivityItem[] = [
            ...requests.map((r) => ({
              kind: "request" as const,
              id: r.id,
              title: r.title,
              status: r.status,
              isEmergency: r.isEmergency,
              category: r.category,
              location: r.location,
              time: r.createdAt,
            })),
            ...donations.map((d) => ({
              kind: "donation" as const,
              id: d.id,
              donorName: d.donorName,
              itemType: d.itemType,
              itemIcon: d.itemIcon,
              quantity: d.quantity,
              time: d.createdAt,
            })),
             ...emergencyAlerts.map((alert) => ({
               kind: "emergency" as const,
               id: alert.id,
               userName: alert.userName,
               userPhone: alert.userPhone,
               serviceName: alert.serviceName,
               serviceNumber: alert.serviceNumber,
               location: alert.location,
               time: alert.createdAt,
             })),
          ]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 25);

          const statChips = [
            { label: "Online", value: onlineCount, color: "#10B981", icon: "radio" as const },
            { label: "Active", value: openReqs.length, color: BLUE_LIGHT, icon: "activity" as const },
             { label: "Alerts", value: emergencyReqs.length + activeEmergencyAlerts, color: "#EF4444", icon: "alert-circle" as const },
             { label: "Geolocated", value: geoReqs.length + geolocatedAlerts, color: "#F59E0B", icon: "map-pin" as const },
          ];

          return (
            <View style={{ padding: 14, gap: 14 }}>
              {/* ── Live stats strip ─────────────────────────────────── */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {statChips.map((chip) => (
                  <View
                    key={chip.label}
                    style={[styles.card, { flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 4 }]}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: chip.color + "18", alignItems: "center", justifyContent: "center" }}>
                      <Feather name={chip.icon} size={13} color={chip.color} />
                    </View>
                    <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E3A5F" }}>{chip.value}</Text>
                    <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" }}>{chip.label}</Text>
                  </View>
                ))}
              </View>

              {/* ── Live map legend ───────────────────────────────────── */}
              <View style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={styles.cardTitle}>Live Activity Map</Text>
                  {/* Live badge */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F8FAFC", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" }} />
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#EF4444" }}>LIVE</Text>
                  </View>
                </View>

                {/* Map */}
                <AdminActivityMap height={320} />

                {/* Legend */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F8FAFC" }}>
                  {[
                    { color: "#2563EB", label: "User online" },
                     { color: "#EF4444", label: "Emergency alert" },
                     { color: "#EF4444", label: "Emergency request" },
                    { color: "#F59E0B", label: "Open request" },
                    { color: "#14B8A6", label: "Being helped" },
                    { color: "#64748B", label: "Completed" },
                  ].map((l) => (
                    <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" }}>{l.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* ── Combined activity feed ───────────────────────────── */}
              <View style={styles.card}>
                <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Live Activity Feed</Text>

                {feedItems.length === 0 && (
                  <Text style={{ color: "#64748B", textAlign: "center", paddingVertical: 20, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                    No activity yet
                  </Text>
                )}

                {feedItems.map((item) => {
                  if (item.kind === "request") {
                    const statusColor =
                      item.isEmergency ? "#EF4444"
                      : item.status === "accepted" ? "#14B8A6"
                      : item.status === "completed" ? "#64748B"
                      : "#F59E0B";
                    const statusLabel =
                      item.status === "accepted" ? "Being helped"
                      : item.status === "completed" ? "Completed"
                      : item.status === "cancelled" ? "Cancelled"
                      : "Open";
                    return (
                      <View key={item.id} style={[styles.requestRow, { alignItems: "flex-start" }]}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                          <Feather name={item.isEmergency ? "alert-circle" : "map-pin"} size={13} color={statusColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requestName} numberOfLines={1}>{item.title}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <View style={{ backgroundColor: statusColor + "18", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: statusColor }}>{statusLabel}</Text>
                            </View>
                            {item.location?.address && (
                              <Text style={[styles.requestLoc, { flex: 1 }]} numberOfLines={1}>{item.location.address}</Text>
                            )}
                          </View>
                        </View>
                        <Text style={styles.reportTime}>{timeAgo(item.time)}</Text>
                      </View>
                    );
                  }

                  if (item.kind === "emergency") {
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.requestRow,
                          {
                            alignItems: "flex-start",
                            backgroundColor: "#F8FAFC",
                            borderRadius: 12,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                          },
                        ]}
                      >
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                          <Text style={{ fontSize: 14 }}>🚨</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.requestName, { color: "#EF4444" }]} numberOfLines={1}>
                            Emergency alert from {item.userName}
                          </Text>
                          <Text style={[styles.requestLoc, { color: "#EF4444", marginTop: 2 }]} numberOfLines={1}>
                            Calling {item.serviceName} · {item.serviceNumber}
                          </Text>
                          <Text style={[styles.requestLoc, { marginTop: 2 }]} numberOfLines={1}>
                            {item.location?.address ?? "Location unavailable"}
                            {item.userPhone ? ` · ${item.userPhone}` : ""}
                          </Text>
                        </View>
                        <Text style={styles.reportTime}>{timeAgo(item.time)}</Text>
                      </View>
                    );
                  }

                  // Donation row
                  return (
                    <View key={item.id} style={[styles.requestRow, { alignItems: "flex-start" }]}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#F8FAFC18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ fontSize: 13 }}>{item.itemIcon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestName} numberOfLines={1}>
                          {item.donorName} donated {item.quantity}× {item.itemType}
                        </Text>
                        <Text style={[styles.requestLoc, { marginTop: 2 }]}>Donation</Text>
                      </View>
                      <Text style={styles.reportTime}>{timeAgo(item.time)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {section === "analytics" && (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Platform Analytics</Text>
              <LineChart width={width - 28} requests={requests} donations={donations} users={allUsers} />
            </View>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Key Metrics</Text>
              {[
                { label: "Avg. Response Time", val: "~12 min", icon: "clock", color: BLUE_LIGHT },
                { label: "Help Success Rate", val: "94%", icon: "check-circle", color: "#10B981" },
                { label: "Emergency Resolve Rate", val: "98%", icon: "alert-circle", color: "#EF4444" },
                { label: "User Satisfaction", val: "4.8/5", icon: "star", color: "#F59E0B" },
                { label: "Repeat Helpers", val: "67%", icon: "repeat", color: "#7C3AED" },
              ].map((m) => (
                <View key={m.label} style={styles.summaryRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name={m.icon as any} size={14} color={m.color} />
                    <Text style={styles.summaryLabel}>{m.label}</Text>
                  </View>
                  <Text style={[styles.summaryVal, { color: m.color }]}>{m.val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {section === "settings" && (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>App Settings</Text>
              {[
                { label: "Notifications", icon: "bell" },
                { label: "Privacy & Security", icon: "shield" },
                { label: "Language", icon: "globe" },
                { label: "Theme", icon: "sun" },
                { label: "Emergency Contacts", icon: "phone" },
                { label: "Terms & Conditions", icon: "file-text" },
              ].map((s) => (
                <View key={s.label} style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Feather name={s.icon as any} size={16} color="#64748B" />
                    <Text style={styles.summaryLabel}>{s.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#DBEAFE" />
                </View>
              ))}
            </View>
            <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
              <View style={[styles.requestAvatar, { width: 50, height: 50, borderRadius: 25, backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.requestAvatarText, { color: BLUE_LIGHT, fontSize: 18 }]}>{user?.name?.charAt(0) ?? "A"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestName}>{user?.name ?? "Admin"}</Text>
                <Text style={styles.requestLoc}>{user?.email}</Text>
                <View style={{ backgroundColor: "#DBEAFE", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" }}>Super Admin</Text>
                </View>
              </View>
              <Pressable
                onPress={handleAdminLogout}
                style={{ padding: 8 }}
              >
                <Feather name="log-out" size={20} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── SIDEBAR DRAWER ── */}
      {drawerOpen && (
        <>
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)", opacity: overlayOpacity, zIndex: 10 }]} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[styles.drawer, { transform: [{ translateX: drawerX }], paddingTop: topPad, zIndex: 20 }]}
          >
            <LinearGradient colors={[BLUE_DARK, BLUE_MID, BLUE_LIGHT]} style={StyleSheet.absoluteFill} />

            {/* Logo */}
            <View style={styles.drawerLogo}>
              <HelpChainLogo width={164} height={100} light />
              <View>
                <Text style={styles.drawerLogoSub}>Admin Panel</Text>
              </View>
            </View>

            <View style={styles.drawerDivider} />

            {/* Nav items */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {NAV_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => navTo(item.key)}
                  style={[styles.drawerItem, section === item.key && styles.drawerItemActive]}
                >
                  <Feather
                    name={item.icon as any}
                    size={16}
                    color={section === item.key ? BLUE_LIGHT : "rgba(255,255,255,0.75)"}
                  />
                  <Text style={[styles.drawerItemText, { color: section === item.key ? BLUE_LIGHT : "rgba(255,255,255,0.85)" }]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.drawerDivider} />

            {/* User + Logout */}
            <View style={styles.drawerUser}>
              <View style={[styles.requestAvatar, { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Text style={[styles.requestAvatarText, { color: "#FFFFFF" }]}>{user?.name?.charAt(0) ?? "A"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerItemText, { color: "#FFFFFF" }]}>{user?.name ?? "Admin"}</Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontFamily: "Inter_400Regular" }}>Super Admin ●</Text>
              </View>
            </View>
            <Pressable
              onPress={() => { closeDrawer(); void handleAdminLogout(); }}
              style={styles.drawerLogout}
            >
              <Feather name="log-out" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.drawerLogoutText}>Logout</Text>
            </Pressable>
            <View style={{ height: Platform.OS === "web" ? 20 : insets.bottom + 12 }} />
          </Animated.View>
        </>
      )}

      <Modal
        visible={systemSummaryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSystemSummaryVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 20 }}>
          <View style={{ width: "100%", maxWidth: 560, maxHeight: "80%", alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 18, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={styles.cardTitle}>System Summary</Text>
              <Pressable
                onPress={() => setSystemSummaryVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close system summary"
                hitSlop={10}
                style={{ padding: 6 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </Pressable>
            </View>
            <Text style={{ color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 }}>
              Current totals for users, help activity, donations, registered centres, and updates.
            </Text>
            <ScrollView>
              {systemSummary.map((summary, index) => {
                const target: Record<string, Section> = {
                  "Registered Users": "users",
                  "Authorised Admins": "users",
                  "Total Help Requests": "requests",
                  "Active Help Requests": "requests",
                  "Donation Contributions": "donations",
                  "Items Donated": "donations",
                  "Registered Community Centres": "centres",
                  "Official Updates": "updates",
                };
                return (
                  <Pressable
                    key={summary.label}
                    onPress={() => {
                      setSystemSummaryVisible(false);
                      navTo(target[summary.label]);
                    }}
                    accessibilityRole="button"
                    style={[styles.summaryRow, index < systemSummary.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }]}
                  >
                    <Text style={styles.summaryLabel}>{summary.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.summaryVal}>{summary.val}</Text>
                      <Feather name="chevron-right" size={14} color="#DBEAFE" />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 5,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { fontSize: 8, color: "#FFFFFF", fontFamily: "Inter_700Bold" },
  dateBox: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F8FAFC", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  dateText: { fontSize: 9, color: "#64748B", fontFamily: "Inter_500Medium" },

  statCard: {
    width: 130,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E3A5F", marginTop: 2 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
  statTrend: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  statTrendText: { fontSize: 9, fontFamily: "Inter_400Regular" },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#0B1F3A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E3A5F" },
  cardTitleSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  cardBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F8FAFC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardBadgeText: { fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" },
  viewAll: { fontSize: 12, color: BLUE_LIGHT, fontFamily: "Inter_600SemiBold" },

  requestRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  requestAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  requestAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: BLUE_LIGHT },
  requestName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E3A5F" },
  requestLoc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  donationRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  donationIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  donationTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E3A5F" },
  donationBy: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  donationAmt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#F59E0B" },
  donationTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#14B8A6", marginTop: 1 },
  donationBanner: { borderRadius: 14, padding: 20, flexDirection: "row", alignItems: "center", gap: 16 },

  reportRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  reportFlag: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E3A5F" },
  reportDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  reportTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
  reportResolveButton: { minHeight: 32, borderRadius: 7, backgroundColor: "#EFF6FF", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  reportResolveText: { color: "#2563EB", fontSize: 11, fontFamily: "Inter_600SemiBold" },

  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  summaryVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1E3A5F" },

  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B", letterSpacing: 0.8, marginBottom: 2 },

  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    overflow: "hidden",
  },
  drawerLogo: { flexDirection: "column", alignItems: "flex-start", gap: 5, padding: 16 },
  drawerLogoSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  drawerDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 16, marginVertical: 6 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 10,
  },
  drawerItemActive: { backgroundColor: "#FFFFFF" },
  drawerItemText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  drawerUser: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  drawerLogout: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  drawerLogoutText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },

  adminActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
});
