"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import { collection, onSnapshot, query, where, type DocumentData } from "firebase/firestore";
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
  createdAt?: { toDate: () => Date } | Date | null;
  updatedAt?: { toDate: () => Date } | Date | null;
};

function formatTicketDate(value: Ticket["createdAt"]) {
  if (!value) return "Just now";

  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
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

export default function StatusPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!db || !user) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const ticketsQuery = query(collection(db, "tickets"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const nextTickets = snapshot.docs.map((doc, index) => {
          const data = doc.data() as DocumentData;

          return {
            id: doc.id,
            ticketNumber: Number(data.ticketNumber ?? index + 1),
            userName: String(data.userName ?? ""),
            contactNo: String(data.contactNo ?? ""),
            location: String(data.location ?? ""),
            model: String(data.model ?? ""),
            serialNumber: String(data.serialNumber ?? ""),
            issue: String(data.issue ?? ""),
            status: normalizeTicketStatus(data.status),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          } satisfies Ticket;
        });

        // Sort by ticket number in ascending order (oldest first)
        nextTickets.sort((a, b) => a.ticketNumber - b.ticketNumber);

        setTickets(nextTickets);
        setLoading(false);
      },
      (error) => {
        if (error.code === "permission-denied" && !auth?.currentUser) {
          setLoading(false);
          return;
        }
        console.error("Status tickets listener error:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/");
  };

  if (!firebaseReady || !auth || !db) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
          <div>Loading...</div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,_#06101d,_#0b1324_46%,_#111827)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
        <section className="mx-auto max-w-7xl">
          <p className="text-xl text-slate-300">Please sign in to check your ticket status.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_85%_85%,_rgba(14,165,233,0.2),_transparent_34%),linear-gradient(180deg,_#040b15_0%,_#071223_44%,_#0e1a30_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-6 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6">
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

        <article>
          <h1 className="mb-8 text-5xl font-bold leading-[1.15] tracking-tight text-white">
            Check Your <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent">Ticket Status</span>
          </h1>

          {loading ? (
            <p className="text-slate-300">Loading your tickets...</p>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-8 text-center">
              <p className="text-slate-300">No tickets submitted yet.</p>
              <button
                onClick={() => router.push("/report")}
                className="mt-4 font-medium text-cyan-300 hover:text-cyan-200"
              >
                Submit your first report
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/status/${ticket.id}`)}
                  className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">{ticket.model}</h3>
                        <span className={`inline-block rounded-lg border px-3 py-1 text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">Serial: {ticket.serialNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Submitted</p>
                      <p className="text-sm font-medium text-slate-300">{formatTicketDate(ticket.createdAt)}</p>
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-500">Location:</span> {ticket.location}
                    </p>
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-500">Issue:</span> {ticket.issue}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-500">
                    <p>Contact: {ticket.contactNo} • Name: {ticket.userName}</p>
                    <span className="font-medium text-cyan-300">View details →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Back to Home
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
