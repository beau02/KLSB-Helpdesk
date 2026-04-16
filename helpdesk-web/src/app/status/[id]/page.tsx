"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, type DocumentData } from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";

type Ticket = {
  id: string;
  userName: string;
  contactNo: string;
  location: string;
  model: string;
  serialNumber: string;
  issue: string;
  status: "On Going" | "Closed";
  autoReply?: string;
  adminReply?: string;
  assignedAdminEmail?: string;
  createdAt?: { toDate: () => Date } | Date | null;
  updatedAt?: { toDate: () => Date } | Date | null;
  repliedAt?: { toDate: () => Date } | Date | null;
  userEmail?: string;
  userId?: string;
};

function formatTicketDate(value: Ticket["createdAt"]) {
  if (!value) return "Just now";

  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function getStatusColor(status: string) {
  switch (status) {
    case "On Going":
      return "bg-amber-500/20 border-amber-400/30 text-amber-200";
    case "Closed":
      return "bg-green-500/20 border-green-400/30 text-green-200";
    default:
      return "bg-slate-500/20 border-slate-400/30 text-slate-200";
  }
}

function normalizeTicketStatus(value: unknown): Ticket["status"] {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "done" || status === "completed" || status === "closed" || status === "resolved") {
    return "Closed";
  }
  return "On Going";
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const BrandLogo = () => (
    <img src="/klsb-logo.png" alt="KLSB Kemuncak Lanai SDN BHD" className="h-auto w-64" />
  );

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!auth) return;

    setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }, []);

  useEffect(() => {
    const firestore = db;

    if (!firestore || !user || !ticketId) {
      setLoading(false);
      return;
    }

    const fetchTicket = async () => {
      try {
        const ticketDoc = await getDoc(doc(firestore, "tickets", ticketId));

        if (!ticketDoc.exists()) {
          setError("Ticket not found.");
          setLoading(false);
          return;
        }

        const data = ticketDoc.data() as DocumentData;

        // Check if user owns this ticket
        if (data.userId !== user.uid) {
          setError("You don't have permission to view this ticket.");
          setLoading(false);
          return;
        }

        setTicket({
          id: ticketDoc.id,
          userName: String(data.userName ?? ""),
          contactNo: String(data.contactNo ?? ""),
          location: String(data.location ?? ""),
          model: String(data.model ?? ""),
          serialNumber: String(data.serialNumber ?? ""),
          issue: String(data.issue ?? ""),
          status: normalizeTicketStatus(data.status),
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          repliedAt: data.repliedAt ?? null,
          autoReply: String(data.autoReply ?? ""),
          adminReply: String(data.adminReply ?? ""),
          assignedAdminEmail: String(data.assignedAdminEmail ?? ""),
          userEmail: String(data.userEmail ?? ""),
          userId: String(data.userId ?? ""),
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading ticket");
        setLoading(false);
      }
    };

    fetchTicket();
  }, [user, ticketId]);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/");
  };

  if (!firebaseReady || !auth || !db) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 px-6 py-10 text-slate-100">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 px-6 py-10 text-slate-100">
        <p>Please sign in to view ticket details.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_85%_85%,_rgba(14,165,233,0.2),_transparent_34%),linear-gradient(180deg,_#040b15_0%,_#071223_44%,_#0e1a30_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-6 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 space-y-8">
        <header className="flex items-center justify-between gap-6 border-b border-cyan-500/10 pb-6">
          <div className="max-w-[300px]">
            <BrandLogo />
          </div>
          <div className="text-sm text-slate-300">
            <span className="font-semibold text-white">{user.email ?? "Guest User"}</span>
            <span className="mx-3 text-slate-600">•</span>
            <button type="button" onClick={handleSignOut} className="font-medium text-cyan-300 transition hover:text-cyan-200">
              Sign out
            </button>
          </div>
        </header>

        <div>
          {loading ? (
            <p className="text-slate-300">Loading ticket details...</p>
          ) : error ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-6 py-4">
              <p className="text-rose-200">{error}</p>
            </div>
          ) : ticket ? (
            <article>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-5xl font-bold tracking-tight text-white leading-[1.15] mb-2">
                    Ticket <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent">{ticket.model}</span>
                  </h1>
                  <p className="text-slate-400">Serial: {ticket.serialNumber}</p>
                </div>
                <span className={`inline-block rounded-lg border px-4 py-2 text-sm font-semibold ${getStatusColor(ticket.status)}`}>
                  {ticket.status}
                </span>
              </div>

              {/* Admin in Charge */}
              {ticket.assignedAdminEmail && (
                <div className="mb-8 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-indigo-300 mb-1">In Charge Of This Ticket</p>
                  <p className="text-lg font-semibold text-indigo-100">{ticket.assignedAdminEmail}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="mb-12 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-8">
                <h2 className="text-2xl font-bold text-white mb-8">Ticket Timeline</h2>
                <div className="h-96 overflow-y-auto pr-4 space-y-12">
                  {/* Submitted */}
                  <div className="flex gap-4 pb-8 min-h-fit">
                    <div className="flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center flex-shrink-0">
                        <div className="h-3 w-3 rounded-full bg-blue-400" />
                      </div>
                      <div className="h-20 w-0.5 bg-gradient-to-b from-blue-400/50 to-transparent mt-2" />
                    </div>
                    <div className="pt-2 flex-1">
                      <p className="font-semibold text-white text-lg">Submitted</p>
                      <p className="text-sm text-slate-400 mt-2">{formatTicketDate(ticket.createdAt)}</p>
                      <p className="text-sm text-slate-300 mt-3">Your ticket was successfully submitted to the support system.</p>
                    </div>
                  </div>

                  {/* Issue Description */}
                  <div className="flex gap-4 pb-8 min-h-fit">
                    <div className="flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-purple-500/30 border border-purple-400/50 flex items-center justify-center flex-shrink-0">
                        <div className="h-3 w-3 rounded-full bg-purple-400" />
                      </div>
                      <div className="h-20 w-0.5 bg-gradient-to-b from-purple-400/50 to-transparent mt-2" />
                    </div>
                    <div className="pt-2 flex-1">
                      <p className="font-semibold text-white text-lg">Issue Details</p>
                      <p className="text-sm text-slate-400 mt-2">{formatTicketDate(ticket.createdAt)}</p>
                      <p className="text-sm text-slate-300 mt-3 border-l-2 border-purple-400/50 pl-3">{ticket.issue}</p>
                    </div>
                  </div>

                  {/* Assigned to Admin */}
                  {ticket.assignedAdminEmail && (
                    <div className="flex gap-4 pb-8 min-h-fit">
                      <div className="flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center flex-shrink-0">
                          <div className="h-3 w-3 rounded-full bg-indigo-400" />
                        </div>
                        <div className="h-20 w-0.5 bg-gradient-to-b from-indigo-400/50 to-transparent mt-2" />
                      </div>
                      <div className="pt-2 flex-1">
                        <p className="font-semibold text-white text-lg">In Charge: {ticket.assignedAdminEmail}</p>
                        <p className="text-sm text-slate-400 mt-2">{formatTicketDate(ticket.repliedAt ?? ticket.updatedAt)}</p>
                        <p className="text-sm text-slate-300 mt-3">Admin assigned to handle this ticket</p>
                      </div>
                    </div>
                  )}

                  {/* Admin Reply */}
                  {ticket.adminReply && (
                    <div className="flex gap-4 pb-8 min-h-fit">
                      <div className="flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-green-500/30 border border-green-400/50 flex items-center justify-center flex-shrink-0">
                          <div className="h-3 w-3 rounded-full bg-green-400" />
                        </div>
                        <div className="h-20 w-0.5 bg-gradient-to-b from-green-400/50 to-transparent mt-2" />
                      </div>
                      <div className="pt-2 flex-1">
                        <p className="font-semibold text-white text-lg">Reply from {ticket.assignedAdminEmail}</p>
                        <p className="text-sm text-slate-400 mt-2">{formatTicketDate(ticket.repliedAt)}</p>
                        <p className="text-sm text-slate-300 mt-3 border-l-2 border-green-400/50 pl-3">{ticket.adminReply}</p>
                      </div>
                    </div>
                  )}

                  {/* Current Status */}
                  <div className="flex gap-4 pb-8 min-h-fit">
                    <div className="flex flex-col items-center">
                      <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        ticket.status === "Closed" ? "bg-green-500/30 border-green-400/50" : "bg-amber-500/30 border-amber-400/50"
                      }`}>
                        <div className={`h-3 w-3 rounded-full ${
                          ticket.status === "Closed" ? "bg-green-400" : "bg-amber-400"
                        }`} />
                      </div>
                      {ticket.status !== "Closed" && <div className="h-20 w-0.5 bg-gradient-to-b from-slate-500/30 to-transparent mt-2" />}
                    </div>
                    <div className="pt-2 flex-1">
                      <p className="font-semibold text-white text-lg">{ticket.status}</p>
                      <p className="text-sm text-slate-400 mt-2">{formatTicketDate(ticket.updatedAt)}</p>
                      <p className="text-sm text-slate-300 mt-3">
                        {ticket.status === "On Going" && "Our team is still working on your issue."}
                        {ticket.status === "Closed" && "Your issue has been resolved."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="grid gap-8 md:grid-cols-2">
                {/* Issue Details */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Issue Details</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Model</p>
                      <p className="text-base text-slate-300 mt-1">{ticket.model}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Serial Number</p>
                      <p className="text-base text-slate-300 mt-1">{ticket.serialNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
                      <p className="text-base text-slate-300 mt-1">{ticket.location}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Full Name</p>
                      <p className="text-base text-slate-300 mt-1">{ticket.userName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contact No.</p>
                      <p className="text-base text-slate-300 mt-1">{ticket.contactNo}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email</p>
                      <p className="text-base text-slate-300 mt-1">{ticket.userEmail}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Issue Description */}
              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Issue Description</h3>
                <p className="text-base leading-relaxed text-slate-300">{ticket.issue}</p>
              </div>

              {/* Back Button */}
              <div className="mt-8">
                <button
                  onClick={() => router.back()}
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  ← Back to Tickets
                </button>
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </main>
  );
}
