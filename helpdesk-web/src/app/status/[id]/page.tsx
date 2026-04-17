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
import { collection, doc, getDoc, getDocs, query, where, type DocumentData } from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";

type Ticket = {
  id: string;
  ticketNumber: number;
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

function formatTicketCode(value: number) {
  return `KLSB-${String(value).padStart(3, "0")}`;
}

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

type TimelineStep = {
  title: string;
  date: Ticket["createdAt"];
  summary: string;
  detail?: string;
  iconClassName: string;
  dotClassName: string;
  lineClassName: string;
  detailBorderClassName: string;
};

function getActiveTimelineStep(ticket: Ticket): TimelineStep {
  if (ticket.status === "Closed") {
    return {
      title: "Closed",
      date: ticket.updatedAt ?? ticket.repliedAt ?? ticket.createdAt,
      summary: "Your issue has been resolved.",
      detail: ticket.adminReply,
      iconClassName: "bg-green-500/30 border-green-400/50",
      dotClassName: "bg-green-400",
      lineClassName: "from-blue-400/50",
      detailBorderClassName: "border-blue-400/50",
    };
  }

  if (ticket.adminReply) {
    return {
      title: `Reply from ${ticket.assignedAdminEmail || "Support Team"}`,
      date: ticket.repliedAt ?? ticket.updatedAt ?? ticket.createdAt,
      summary: "You received an update from support.",
      detail: ticket.adminReply,
      iconClassName: "bg-indigo-500/30 border-indigo-400/50",
      dotClassName: "bg-indigo-400",
      lineClassName: "from-blue-400/50",
      detailBorderClassName: "border-blue-400/50",
    };
  }

  if (ticket.assignedAdminEmail) {
    return {
      title: `In Charge: ${ticket.assignedAdminEmail}`,
      date: ticket.repliedAt ?? ticket.updatedAt ?? ticket.createdAt,
      summary: "Admin assigned to handle this ticket.",
      iconClassName: "bg-indigo-500/30 border-indigo-400/50",
      dotClassName: "bg-indigo-400",
      lineClassName: "from-blue-400/50",
      detailBorderClassName: "border-blue-400/50",
    };
  }

  return {
    title: "Submitted",
    date: ticket.createdAt,
    summary: "Your ticket was successfully submitted to the support system.",
    detail: ticket.issue,
    iconClassName: "bg-blue-500/30 border-blue-400/50",
    dotClassName: "bg-blue-400",
    lineClassName: "from-blue-400/50",
    detailBorderClassName: "border-blue-400/50",
  };
}

function getTimelineSteps(ticket: Ticket): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      title: "Submitted",
      date: ticket.createdAt,
      summary: "Your ticket was successfully submitted to the support system.",
      detail: ticket.issue,
      iconClassName: "bg-blue-500/30 border-blue-400/50",
      dotClassName: "bg-blue-400",
      lineClassName: "from-blue-400/50",
      detailBorderClassName: "border-blue-400/50",
    },
  ];

  if (ticket.assignedAdminEmail) {
    steps.push({
      title: `In Charge: ${ticket.assignedAdminEmail}`,
      date: ticket.repliedAt ?? ticket.updatedAt ?? ticket.createdAt,
      summary: "Admin assigned to handle this ticket.",
      iconClassName: "bg-indigo-500/30 border-indigo-400/50",
      dotClassName: "bg-indigo-400",
      lineClassName: "from-blue-400/50",
      detailBorderClassName: "border-blue-400/50",
    });
  }

  if (ticket.adminReply) {
    steps.push({
      title: `Reply from ${ticket.assignedAdminEmail || "Support Team"}`,
      date: ticket.repliedAt ?? ticket.updatedAt ?? ticket.createdAt,
      summary: "You received an update from support.",
      detail: ticket.adminReply,
      iconClassName: "bg-purple-500/30 border-purple-400/50",
      dotClassName: "bg-purple-400",
      lineClassName: "from-blue-400/50",
      detailBorderClassName: "border-blue-400/50",
    });
  }

  steps.push({
    title: ticket.status,
    date: ticket.updatedAt ?? ticket.repliedAt ?? ticket.createdAt,
    summary:
      ticket.status === "Closed"
        ? "Your issue has been resolved."
        : "Our team is still working on your issue.",
    iconClassName:
      ticket.status === "Closed"
        ? "bg-green-500/30 border-green-400/50"
        : "bg-amber-500/30 border-amber-400/50",
    dotClassName: ticket.status === "Closed" ? "bg-green-400" : "bg-amber-400",
    lineClassName: "from-blue-400/50",
    detailBorderClassName: "border-blue-400/50",
  });

  return steps;
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketCode, setTicketCode] = useState("");
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
          ticketNumber: Number(data.ticketNumber ?? 1),
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

        const userTicketsQuery = query(collection(firestore, "tickets"), where("userId", "==", user.uid));
        const userTicketsSnapshot = await getDocs(userTicketsQuery);
        const userTickets = userTicketsSnapshot.docs
          .map((ticketDocument) => ({
            id: ticketDocument.id,
            createdAt: ticketDocument.data().createdAt ?? null,
          }))
          .sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate() ?? new Date(0);
            const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate() ?? new Date(0);
            return dateA.getTime() - dateB.getTime();
          });

        const ticketIndex = userTickets.findIndex((ticketItem) => ticketItem.id === ticketDoc.id);
        setTicketCode(formatTicketCode(ticketIndex >= 0 ? ticketIndex + 1 : 1));
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

  const timelineSteps = ticket ? getTimelineSteps(ticket) : [];

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
                    Ticket <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent">{ticketCode || formatTicketCode(1)}</span>
                  </h1>
                  <p className="text-slate-400">Model: {ticket.model} | Serial: {ticket.serialNumber}</p>
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
                <div className="mb-4 flex items-end justify-between gap-4">
                  <h2 className="text-2xl font-bold text-white">Ticket Timeline</h2>
                  <p className="text-xs text-cyan-200/80">Scroll to view next update</p>
                </div>
                <div className="hide-scrollbar relative h-56 snap-y snap-mandatory overflow-y-auto">
                  <div className="pointer-events-none absolute left-[23px] top-0 h-full w-[2px] bg-gradient-to-b from-blue-400/75 via-blue-400/45 to-blue-300/10" />
                  <div className="relative">
                    {timelineSteps.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="snap-start min-h-56 py-2">
                        <div className="flex gap-4">
                          <div className="flex w-12 flex-col items-center">
                            <div className={`h-12 w-12 rounded-full border flex items-center justify-center flex-shrink-0 ${step.iconClassName}`}>
                              <div className={`h-3 w-3 rounded-full ${step.dotClassName}`} />
                            </div>
                            <div className="mt-2 h-16 w-[2px] bg-blue-400/55" />
                          </div>
                          <div className="pt-2 flex-1">
                            <p className="font-semibold text-white text-lg">{step.title}</p>
                            <p className="text-sm text-slate-400 mt-2">{formatTicketDate(step.date)}</p>
                            <p className="text-sm text-slate-300 mt-3">{step.summary}</p>
                            {step.detail ? (
                              <p className={`text-sm text-slate-300 mt-3 border-l-2 pl-3 ${step.detailBorderClassName}`}>
                                {step.detail}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
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
