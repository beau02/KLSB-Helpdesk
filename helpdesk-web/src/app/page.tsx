"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

      // Sort by createdAt descending on client-side
      nextTickets.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate() ?? new Date(0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate() ?? new Date(0);
        return dateB.getTime() - dateA.getTime();
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),linear-gradient(135deg,_#08111f,_#0f172a_48%,_#111827)] px-6 py-10 text-slate-100 sm:px-10">
        <div className="ml-0">
          <div className="mb-12 flex items-start justify-between">
            <BrandLogo />
            <span className="inline-flex rounded-full border border-cyan-400/50 bg-cyan-400/20 px-5 py-2 text-sm font-semibold text-cyan-300 shadow-lg shadow-cyan-500/20">
              KLSB Helpdesk
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
              <div className="mb-8 border-b border-white/10 pb-6">
                <h2 className="text-center text-lg font-semibold text-white">Access your account</h2>
                <p className="mt-1 text-center text-sm text-slate-400">
                  {mode === "login" ? "Sign in to your account" : "Create a new account to get started"}
                </p>
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
            <article className="flex items-center justify-between gap-12">
              <div className="flex-1 space-y-6">
                <h2 className="text-5xl font-bold tracking-tight text-white leading-[1.15]">
                  Welcome to<br />
                  <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent">KLSB Support Center</span>
                </h2>
                <p className="text-base leading-relaxed text-slate-300/95 max-w-md">
                  Streamline your support requests with our intelligent ticket system. Every request is assigned a unique number for easy tracking, with complete archives and history available for your reference.
                </p>
              </div>

              <div className="flex flex-col gap-4 min-w-max">
                <button
                  type="button"
                  onClick={() => router.push("/report")}
                  className="group relative rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-500 px-6 py-3 text-sm font-bold text-slate-900 shadow-[0_12px_32px_rgba(34,211,238,0.3),0_0_0_1px_rgba(125,249,255,0.2)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(34,211,238,0.4)] hover:-translate-y-1 active:translate-y-0 overflow-hidden"
                >
                  <span className="relative z-10">Report an Issue</span>
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/status")}
                  className="group relative rounded-xl bg-gradient-to-br from-lime-500/40 via-lime-400/30 to-green-500/40 border border-lime-300/30 px-6 py-3 text-sm font-bold text-lime-50 shadow-[0_12px_32px_rgba(132,204,22,0.2),0_0_0_1px_rgba(168,226,46,0.15)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(132,204,22,0.3)] hover:-translate-y-1 active:translate-y-0 overflow-hidden backdrop-blur-sm"
                >
                  <span className="relative z-10">Check Status</span>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
              </div>
            </article>
          </div>
      </section>
    </main>
  );
}
