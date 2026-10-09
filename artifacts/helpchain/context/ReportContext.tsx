import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

export const REPORT_REASONS = ["Misleading information", "Duplicate request", "Inappropriate content", "Safety concern"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface CommunityReport {
  id: string;
  requestId: string;
  requestTitle: string;
  reporterId: string;
  reporterName: string;
  reason: ReportReason;
  status: "pending" | "resolved";
  createdAt: string;
  updatedAt?: string;
}

interface ReportContextValue {
  reports: CommunityReport[];
  loading: boolean;
  createReport: (input: { requestId: string; requestTitle: string; reason: ReportReason }) => Promise<void>;
  resolveReport: (reportId: string) => Promise<void>;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const reportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    return onSnapshot(
      reportsQuery,
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CommunityReport, "id">) })));
        setLoading(false);
      },
      (error) => {
        console.warn("[ReportContext] snapshot error:", error.code);
        setLoading(false);
      }
    );
  }, [user?.id, user?.isAdmin]);

  async function createReport(input: { requestId: string; requestTitle: string; reason: ReportReason }) {
    if (!user) throw new Error("Sign in before submitting a report.");
    const createdAt = new Date().toISOString();
    await addDoc(collection(db, "reports"), {
      requestId: input.requestId,
      requestTitle: input.requestTitle,
      reporterId: user.id,
      reporterName: user.name,
      reason: input.reason,
      status: "pending",
      createdAt,
      _serverTs: serverTimestamp(),
    });
  }

  async function resolveReport(reportId: string) {
    if (!user?.isAdmin) throw new Error("Administrator access is required.");
    await updateDoc(doc(db, "reports", reportId), {
      status: "resolved",
      updatedAt: new Date().toISOString(),
      _serverTs: serverTimestamp(),
    });
  }

  return (
    <ReportContext.Provider value={{ reports, loading, createReport, resolveReport }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReports() {
  const context = useContext(ReportContext);
  if (!context) throw new Error("useReports must be used within ReportProvider");
  return context;
}
