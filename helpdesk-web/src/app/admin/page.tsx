"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";
import { resolveTicketCode, resolveTicketNumber } from "@/lib/ticket";

type Ticket = {
  id: string;
  ticketNumber: number;
  ticketCode: string;
  displayTicketNumber: number;
  userId: string;
  userEmail: string;
  subject: string;
  description: string;
  priority: string;
  status: "On Going" | "Closed";
  autoReply: string;
  adminReply: string;
  assignedAdminEmail?: string;
  createdAt?: { toDate: () => Date } | Date | null;
  updatedAt?: { toDate: () => Date } | Date | null;
  repliedAt?: { toDate: () => Date } | Date | null;
};

function formatTicketDate(value: Ticket["createdAt"]) {
  if (!value) return "Just now";

  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTicketTimestamp(value: Ticket["createdAt"]) {
  if (!value) return 0;
  const date = value instanceof Date ? value : value.toDate();
  return date.getTime();
}

function normalizeTicketStatus(value: unknown): "On Going" | "Closed" {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "done" || status === "completed" || status === "closed" || status === "resolved") {
    return "Closed";
  }
  return "On Going";
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("On Going");
  const [editingPriority, setEditingPriority] = useState<string>("Medium");
  const [adminReplyDraft, setAdminReplyDraft] = useState<string>("");
  const [savingTicket, setSavingTicket] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const handleSignOut = () => {
    if (!auth) return;
    void signOut(auth);
  };

  const BrandLogo = () => (
    <img src="/klsb-logo.png" alt="KLSB Kemuncak Lanai SDN BHD" className="h-auto w-48" />
  );

  useEffect(() => {
    if (!auth || !db) return;
    const firestore = db;

    let unsubscribeRole: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }

      if (nextUser) {
        // Check user role from Firestore
        const userQuery = query(collection(firestore, "users"), where("uid", "==", nextUser.uid));
        unsubscribeRole = onSnapshot(
          userQuery,
          (snapshot) => {
            if (!snapshot.empty) {
              const userData = snapshot.docs[0].data();
              if (userData.role === "admin") {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
                router.push("/");
              }
            } else {
              setIsAdmin(false);
              router.push("/");
            }
          },
          (error) => {
            if (error.code === "permission-denied" && !auth?.currentUser) {
              return;
            }
            console.error("Admin role listener error:", error);
          },
        );
      } else {
        setIsAdmin(false);
        router.push("/");
      }
    });

    return () => {
      if (unsubscribeRole) unsubscribeRole();
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!db || !isAdmin) {
      setTickets([]);
      return;
    }

    const ticketsQuery = query(collection(db, "tickets"));

    return onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const nextTickets = snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;
          const issueText = String(data.issue ?? "").trim();
          const descriptionText = String(data.description ?? "").trim();

          return {
            id: doc.id,
            ticketNumber: Number(data.ticketNumber ?? 0),
            ticketCode: String(data.ticketCode ?? "").trim(),
            displayTicketNumber: 0,
            userId: String(data.userId ?? ""),
            userEmail: String(data.userEmail ?? ""),
            subject: descriptionText || issueText || "Issue Report",
            description: descriptionText || issueText,
            priority: String(data.priority ?? "Medium"),
            status: normalizeTicketStatus(data.status),
            autoReply: String(data.autoReply ?? ""),
            adminReply: String(data.adminReply ?? ""),
            assignedAdminEmail: String(data.assignedAdminEmail ?? ""),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
            repliedAt: data.repliedAt ?? null,
          } satisfies Ticket;
        });

        // Keep a stable chronological rank so oldest submission remains KLSB-001.
        const chronologicalTickets = [...nextTickets].sort((a, b) => {
          const timestampDiff = getTicketTimestamp(a.createdAt) - getTicketTimestamp(b.createdAt);
          if (timestampDiff !== 0) return timestampDiff;
          return a.id.localeCompare(b.id);
        });

        const ticketRankById = new Map<string, number>();
        chronologicalTickets.forEach((ticket, index) => {
          ticketRankById.set(ticket.id, index + 1);
        });

        // Show latest tickets first.
        nextTickets.sort((a, b) => {
          const timestampDiff = getTicketTimestamp(b.createdAt) - getTicketTimestamp(a.createdAt);
          if (timestampDiff !== 0) return timestampDiff;
          return b.id.localeCompare(a.id);
        });

        // Use validated ticket number values and ignore legacy timestamp-based values.
        nextTickets.forEach((ticket) => {
          const chronologicalRank = ticketRankById.get(ticket.id) ?? 1;
          ticket.displayTicketNumber = resolveTicketNumber(ticket.ticketCode, ticket.ticketNumber, chronologicalRank);
        });

        setTickets(nextTickets);
      },
      (error) => {
        if (error.code === "permission-denied" && !auth?.currentUser) {
          return;
        }
        console.error("Admin tickets listener error:", error);
      },
    );
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTicket) return;

    setEditingStatus(selectedTicket.status || "On Going");
    setEditingPriority(selectedTicket.priority || "Medium");
    setAdminReplyDraft(selectedTicket.adminReply || "");
    setSaveMessage("");
  }, [selectedTicket]);

  const handleSaveTicketUpdate = async () => {
    if (!db || !selectedTicket || !user) return;

    setSavingTicket(true);
    setSaveMessage("");

    try {
      const updateData: Record<string, unknown> = {
        status: editingStatus,
        priority: editingPriority,
        adminReply: adminReplyDraft.trim(),
        updatedAt: serverTimestamp(),
        repliedAt: adminReplyDraft.trim() ? serverTimestamp() : selectedTicket.repliedAt ?? null,
      };

      // Assign ticket to admin if there's a reply
      if (adminReplyDraft.trim()) {
        updateData.assignedAdminEmail = user.email;
      }

      await updateDoc(doc(db, "tickets", selectedTicket.id), updateData);

      setSaveMessage("Saved. Ticket updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update ticket";
      setSaveMessage(`Error: ${message}`);
    } finally {
      setSavingTicket(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const statusMatch = filterStatus === "All" || ticket.status === filterStatus;
    const priorityMatch = filterPriority === "All" || ticket.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  if (!firebaseReady || !auth || !db) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
          <p className="text-center text-slate-300">Loading...</p>
        </section>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Redirecting...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_85%_85%,_rgba(14,165,233,0.2),_transparent_34%),linear-gradient(180deg,_#040b15_0%,_#071223_44%,_#0e1a30_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-6 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex items-center justify-between gap-6 border-b border-slate-700/30 pb-8">
          <div className="max-w-[250px]">
            <BrandLogo />
          </div>
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => router.push("/admin/register")}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 hover:text-cyan-100"
            >
              New Admin
            </button>
            <div className="text-right">
              <p className="text-sm text-slate-300">Logged in as</p>
              <p className="font-semibold text-white">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-1 bg-cyan-500/30 border border-cyan-400/50 rounded text-xs font-bold text-cyan-200 uppercase">Admin</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
              <p className="mt-2 text-slate-300">Total Tickets: <span className="font-semibold text-cyan-300">{filteredTickets.length}</span> of <span className="font-semibold text-cyan-300">{tickets.length}</span></p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
              >
                <option>All</option>
                <option>On Going</option>
                <option>Closed</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Priority</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
              >
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="overflow-hidden rounded-xl border border-slate-700/40 bg-slate-900/40 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/40 bg-slate-900/70">
                    <th className="px-6 py-4 text-left font-semibold text-white">ID</th>
                    <th className="px-6 py-4 text-left font-semibold text-white">User Email</th>
                    <th className="px-6 py-4 text-left font-semibold text-white">Subject</th>
                    <th className="px-6 py-4 text-left font-semibold text-white">Priority</th>
                    <th className="px-6 py-4 text-left font-semibold text-white">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-white">Date</th>
                    <th className="px-6 py-4 text-center font-semibold text-white">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                        No tickets found
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-900/50 transition">
                        <td className="px-6 py-4 font-mono text-xs text-cyan-300">{resolveTicketCode(ticket.ticketCode, ticket.ticketNumber, ticket.displayTicketNumber)}</td>
                        <td className="px-6 py-4 text-slate-300">{ticket.userEmail}</td>
                        <td className="px-6 py-4 max-w-xs truncate text-white">{ticket.subject}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                              ticket.priority === "Critical"
                                ? "bg-red-500/30 text-red-200"
                                : ticket.priority === "High"
                                ? "bg-orange-500/30 text-orange-200"
                                : ticket.priority === "Medium"
                                ? "bg-yellow-500/30 text-yellow-200"
                                : "bg-green-500/30 text-green-200"
                            }`}
                          >
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                              ticket.status === "Closed"
                                ? "bg-green-500/30 text-green-200"
                                : "bg-amber-500/30 text-amber-200"
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{formatTicketDate(ticket.createdAt)}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-3 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6 border-b border-slate-700/40 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedTicket.subject}</h2>
                <p className="text-sm text-slate-400 mt-2">Ticket #: <span className="font-mono text-cyan-300">{resolveTicketCode(selectedTicket.ticketCode, selectedTicket.ticketNumber, selectedTicket.displayTicketNumber)}</span></p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white transition text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">User Email</p>
                  <p className="text-white">{selectedTicket.userEmail}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Priority</p>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedTicket.priority === "Critical"
                        ? "bg-red-500/30 text-red-200"
                        : selectedTicket.priority === "High"
                        ? "bg-orange-500/30 text-orange-200"
                        : selectedTicket.priority === "Medium"
                        ? "bg-yellow-500/30 text-yellow-200"
                        : "bg-green-500/30 text-green-200"
                    }`}
                  >
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Status</p>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedTicket.status === "Closed"
                        ? "bg-green-500/30 text-green-200"
                        : "bg-amber-500/30 text-amber-200"
                    }`}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Created</p>
                <p className="text-slate-300">{formatTicketDate(selectedTicket.createdAt)}</p>
              </div>

              {selectedTicket.assignedAdminEmail && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Assigned To Admin</p>
                  <p className="text-slate-300">{selectedTicket.assignedAdminEmail}</p>
                </div>
              )}

              <div className="border-t border-slate-700/40 pt-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Description</p>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="border-t border-slate-700/40 pt-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Auto Reply Message</p>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap rounded-lg border border-slate-700/40 bg-slate-800/30 p-3">
                  {selectedTicket.autoReply || "No auto reply message recorded."}
                </p>
              </div>

              <div className="border-t border-slate-700/40 pt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm text-slate-200 space-y-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Update Status</span>
                    <select
                      value={editingStatus}
                      onChange={(event) => setEditingStatus(event.target.value)}
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                    >
                      <option>On Going</option>
                      <option>Closed</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-200 space-y-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Update Priority</span>
                    <select
                      value={editingPriority}
                      onChange={(event) => setEditingPriority(event.target.value)}
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </label>
                </div>

                <label className="text-sm text-slate-200 space-y-2 block">
                  <span className="text-xs uppercase tracking-wider text-slate-400">Admin Reply</span>
                  <textarea
                    value={adminReplyDraft}
                    onChange={(event) => setAdminReplyDraft(event.target.value)}
                    rows={4}
                    placeholder="Reply to customer..."
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                  />
                </label>

                {saveMessage ? (
                  <p className={`text-sm ${saveMessage.startsWith("Error:") ? "text-rose-300" : "text-green-300"}`}>
                    {saveMessage}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-700/40 pt-6 flex gap-3">
              <button
                onClick={handleSaveTicketUpdate}
                disabled={savingTicket}
                className="flex-1 rounded-lg bg-cyan-500/80 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTicket ? "Saving..." : "Save Update"}
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="flex-1 rounded-lg bg-slate-700/50 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-700/70"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
