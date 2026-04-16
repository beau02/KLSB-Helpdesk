"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt?: { toDate: () => Date } | Date | null;
};

type AuthMode = "login" | "register";

const defaultForm = {
  subject: "",
  description: "",
  category: "Hardware",
  priority: "Medium",
};

function formatTicketDate(value: Ticket["createdAt"]) {
  if (!value) return "Just now";

  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketForm, setTicketForm] = useState(defaultForm);
  const [ticketError, setTicketError] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const handleSignOut = () => {
    if (!auth) return;

    void signOut(auth);
  };

  const BrandLogo = () => (
    <img src="/klsb-logo.png" alt="KLSB Kemuncak Lanai SDN BHD" className="h-auto w-64" />
  );

  const stats = useMemo(
    () => [
      { label: "Open tickets", value: tickets.length.toString() },
      { label: "Priority", value: ticketForm.priority },
      { label: "Workspace", value: "Firebase" },
    ],
    [ticketForm.priority, tickets.length],
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
      return;
    }

    const ticketsQuery = query(
      collection(db, "tickets"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(ticketsQuery, (snapshot) => {
      const nextTickets = snapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData;

        return {
          id: doc.id,
          subject: String(data.subject ?? ""),
          description: String(data.description ?? ""),
          category: String(data.category ?? ""),
          priority: String(data.priority ?? ""),
          status: String(data.status ?? "Open"),
          createdAt: data.createdAt ?? null,
        } satisfies Ticket;
      });

      setTickets(nextTickets);
    });
  }, [user]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");

    if (!auth) {
      setAuthError("Firebase auth is not configured yet.");
      return;
    }

    setLoadingAuth(true);

    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setAuthError(message);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleTicketSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTicketError("");
    setTicketSuccess("");

    if (!db || !user) {
      setTicketError("Sign in before creating a ticket.");
      return;
    }

    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      setTicketError("Subject and description are required.");
      return;
    }

    setSubmittingTicket(true);

    try {
      await addDoc(collection(db, "tickets"), {
        userId: user.uid,
        userEmail: user.email,
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
        category: ticketForm.category,
        priority: ticketForm.priority,
        status: "Open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTicketForm(defaultForm);
      setTicketSuccess("Ticket created successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create ticket.";
      setTicketError(message);
    } finally {
      setSubmittingTicket(false);
    }
  };

  if (!firebaseReady || !auth || !db) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
          <div className="grid w-full gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-6">
              <BrandLogo />
              <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-sm font-medium text-cyan-200">
                Firebase setup required
              </span>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Support and warranty assistance for KLSB projects and devices.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                The login page is ready, but Firebase environment variables need to be configured.
              </p>
              <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/45 p-5 text-sm text-slate-300 sm:grid-cols-2">
                <p>NEXT_PUBLIC_FIREBASE_API_KEY</p>
                <p>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</p>
                <p>NEXT_PUBLIC_FIREBASE_PROJECT_ID</p>
                <p>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</p>
                <p>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</p>
                <p>NEXT_PUBLIC_FIREBASE_APP_ID</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-6 text-sm text-slate-300">
              <h2 className="text-lg font-semibold text-white">What this app does</h2>
              <ul className="mt-4 space-y-3">
                <li>Sign up or sign in with Firebase Auth.</li>
                <li>Create tickets in Firestore.</li>
                <li>See your recent tickets immediately after submission.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_34%),linear-gradient(135deg,_#08111f,_#0f172a_48%,_#111827)] px-6 py-10 text-slate-100 sm:px-10">
        <div className="ml-0">
          <div className="mb-12 flex items-start justify-between">
            <BrandLogo />
            <span className="inline-flex rounded-full border border-cyan-400/50 bg-cyan-400/20 px-5 py-2 text-sm font-semibold text-cyan-300 shadow-lg shadow-cyan-500/20">
              Helpdesk portal
            </span>
          </div>
          <section className="mx-auto grid max-w-6xl min-h-[calc(100vh-12rem)] gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
              <h1 className="max-w-2xl text-5xl font-black tracking-tight text-white sm:text-6xl">
                Your one stop centre
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                Comprehensive support and warranty assistance for all KLSB's clients in one secure portal.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
              <div className="mb-8 pb-6 border-b border-white/10">
                <h2 className="text-center text-lg font-semibold text-white">Access your account</h2>
                <p className="mt-1 text-center text-sm text-slate-400">{mode === "login" ? "Sign in to your account" : "Create a new account to get started"}</p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleAuthSubmit}>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400/50"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400/50"
                  placeholder="Minimum 6 characters"
                />
              </label>
              {authError ? (
                <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {authError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loadingAuth}
                  className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAuth ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
              </button>
              
              <div className="text-center text-sm text-slate-300">
                {mode === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
                    >
                      Create now
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
              
              <div className="mt-8 border-t border-white/10 pt-6">
                <p className="text-center text-xs text-slate-400">
                  By accessing this portal, you agree to our terms of service and privacy policy.
                </p>
              </div>
            </form>
          </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(135deg,_#06101d,_#0b1324_46%,_#111827)] px-6 py-8 text-slate-100 sm:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-cyan-200/80">KLSB Helpdesk</span>
            <h1 className="mt-2 text-3xl font-semibold text-white">New ticket workspace</h1>
            <p className="mt-2 text-sm text-slate-300">
              Support and warranty requests for KLSB projects and devices.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="self-start rounded-full border border-white/10 bg-slate-950/40 px-5 py-2.5 text-sm font-medium text-white transition hover:border-cyan-400/40 hover:bg-slate-950/70"
          >
            Sign out
          </button>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Create a ticket</h2>
                <p className="mt-2 text-sm text-slate-300">Submit the request details and it will be saved to Firestore.</p>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                Live sync
              </span>
            </div>

            <form className="mt-8 grid gap-4" onSubmit={handleTicketSubmit}>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Subject</span>
                <input
                  value={ticketForm.subject}
                  onChange={(event) =>
                    setTicketForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                  placeholder="Example: Laptop will not connect to Wi-Fi"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span>Description</span>
                <textarea
                  value={ticketForm.description}
                  onChange={(event) =>
                    setTicketForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                  placeholder="Tell the support team what happened, when it started, and what you already tried."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm text-slate-300">
                  <span>Category</span>
                  <select
                    value={ticketForm.category}
                    onChange={(event) =>
                      setTicketForm((current) => ({ ...current, category: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
                  >
                    <option>Hardware</option>
                    <option>Software</option>
                    <option>Account</option>
                    <option>Network</option>
                    <option>Access</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-300">
                  <span>Priority</span>
                  <select
                    value={ticketForm.priority}
                    onChange={(event) =>
                      setTicketForm((current) => ({ ...current, priority: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
              </div>

              {ticketError ? (
                <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {ticketError}
                </p>
              ) : null}

              {ticketSuccess ? (
                <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {ticketSuccess}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submittingTicket}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingTicket ? "Submitting..." : "Create ticket"}
              </button>
            </form>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Recent tickets</h2>
                <p className="mt-2 text-sm text-slate-300">Your latest Firestore entries appear here automatically.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {tickets.length} total
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {tickets.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                  No tickets yet. Create the first one on the left.
                </div>
              ) : (
                tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{ticket.subject}</h3>
                        <p className="mt-1 text-sm text-slate-300">{ticket.category}</p>
                      </div>
                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="mt-4 max-h-24 overflow-hidden text-sm leading-6 text-slate-300">
                      {ticket.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>{ticket.status}</span>
                      <span>{formatTicketDate(ticket.createdAt)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
