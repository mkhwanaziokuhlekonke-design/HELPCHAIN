import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { db } from "@/lib/firebase";

interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  donationId?: string;
  requestId?: string;
  previousStatus?: string | null;
  newStatus?: string;
  quantity?: number;
  createdAt: string;
  centreName?: string;
  collectionId?: string;
  item?: string;
  beneficiaryCategory?: string;
  reason?: string;
  proofProvided?: boolean;
}

export function DonationAuditTimeline({
  parentId,
  request = false,
}: {
  parentId: string;
  request?: boolean;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parentCollection = request ? "donationRequests" : "donations";
    const ref = collection(db, parentCollection, parentId, "auditTrail");
    const unsubscribe = onSnapshot(
      query(ref, orderBy("createdAt", "desc")),
      (snapshot) => {
        setEntries(snapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<AuditEntry, "id">),
        })));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.warn("[DonationAuditTimeline] could not load audit history:", snapshotError.code);
        setLoading(false);
        setError("Audit history could not be loaded.");
      }
    );
    return unsubscribe;
  }, [parentId, request]);

  if (loading) return <ActivityIndicator size="small" color="#0D9488" />;
  if (error) return <Text style={{ color: "#B91C1C", fontSize: 12 }}>{error}</Text>;
  if (entries.length === 0) return <Text style={{ color: "#64748B", fontSize: 12 }}>No audit events recorded.</Text>;

  return (
    <View style={{ gap: 9 }}>
      {entries.map((entry) => (
        <View key={entry.id} style={{ borderLeftWidth: 2, borderLeftColor: "#14B8A6", paddingLeft: 10, gap: 2 }}>
          <Text style={{ color: "#1E3A5F", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            {entry.actorName} · {entry.action.replaceAll("-", " ")}
          </Text>
          {entry.previousStatus !== undefined && (
            <Text style={{ color: "#64748B", fontSize: 11 }}>
              {entry.previousStatus ?? "Created"} → {entry.newStatus}
              {entry.quantity ? ` · Qty ${entry.quantity}` : ""}
            </Text>
          )}
          {entry.centreName && <Text style={{ color: "#64748B", fontSize: 11 }}>{entry.centreName}</Text>}
          {(entry.item || entry.beneficiaryCategory || entry.collectionId || entry.reason || entry.proofProvided) && (
            <Text style={{ color: "#64748B", fontSize: 11 }}>
              {[entry.item, entry.beneficiaryCategory, entry.collectionId, entry.reason, entry.proofProvided ? "Proof attached" : ""]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
          <Text style={{ color: "#94A3B8", fontSize: 10 }}>
            {new Date(entry.createdAt).toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}
