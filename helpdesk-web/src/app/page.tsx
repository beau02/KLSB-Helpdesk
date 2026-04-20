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
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";
import { allocateNextTicketNumber, formatTicketCode } from "@/lib/ticket";

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
  const [userRole, setUserRole] = useState<string | null>(null);
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
    if (!auth || !db) return;
    const firestore = db;

    let unsubscribeRole: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);

      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }

      // Fetch user role from Firestore
      if (nextUser) {
        const userQuery = query(collection(firestore, "users"), where("uid", "==", nextUser.uid));
        unsubscribeRole = onSnapshot(
          userQuery,
          (snapshot) => {
            if (!snapshot.empty) {
              const userData = snapshot.docs[0].data();
              setUserRole(userData.role || "user");
            } else {
              setUserRole("user");
            }
          },
          (error) => {
            if (error.code === "permission-denied" && !auth?.currentUser) {
              return;
            }
            console.error("Users role listener error:", error);
          },
        );
      } else {
        setUserRole(null);
      }
    });

    return () => {
      if (unsubscribeRole) unsubscribeRole();
      unsubscribe();
    };
  }, [db]);

  useEffect(() => {
    if (user && userRole === "admin") {
      router.push("/admin");
    }
  }, [router, user, userRole]);

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

    return onSnapshot(
      ticketsQuery,
      (snapshot) => {
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
      },
      (error) => {
        if (error.code === "permission-denied" && !auth?.currentUser) {
          return;
        }
        console.error("User tickets listener error:", error);
      },
    );
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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Store user role in Firestore
        if (db) {
          await addDoc(collection(db, "users"), {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            role: "user",
            createdAt: serverTimestamp(),
          });
        }
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
      const autoReplyMessage = "Thank you for your report. We have received your submission and will contact you soon for further action.";
      const ticketNumber = await allocateNextTicketNumber(db);
      const ticketCode = formatTicketCode(ticketNumber);

      const ticketRef = await addDoc(collection(db, "tickets"), {
        ticketNumber,
        ticketCode,
        userId: user.uid,
        userEmail: user.email,
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
        category: ticketForm.category,
        priority: ticketForm.priority,
        status: "On Going",
        autoReply: autoReplyMessage,
        adminReply: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        repliedAt: serverTimestamp(),
      });

      const notificationResponse = await fetch("/api/notifications/ticket-submitted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId: ticketRef.id,
          ticketCode,
          userEmail: user.email,
          subject: ticketForm.subject.trim(),
          description: ticketForm.description.trim(),
          category: ticketForm.category,
          priority: ticketForm.priority,
          autoReplyMessage,
        }),
      });

      if (!notificationResponse.ok) {
        const result = (await notificationResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Ticket was saved, but the email notification failed.");
      }

      setTicketForm(defaultForm);
      setTicketSuccess("Ticket created successfully. Auto reply message sent to you and the admins.");
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
          <div className="grid w-full gap-8 overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-900/40 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-6">
              <BrandLogo />
              <span className="inline-flex rounded-full border border-cyan-400/50 bg-cyan-400/15 px-4 py-1 text-sm font-semibold text-cyan-300">
                Configuration Required
              </span>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Support and warranty assistance for KLSB projects and devices.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                System initialization in progress. Backend configuration being established.
              </p>
              <div className="grid gap-3 rounded-xl border border-slate-700/40 bg-slate-950/60 p-5 text-sm text-slate-300 sm:grid-cols-2">
                <p className="font-mono">NEXT_PUBLIC_FIREBASE_API_KEY</p>
                <p className="font-mono">NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</p>
                <p className="font-mono">NEXT_PUBLIC_FIREBASE_PROJECT_ID</p>
                <p className="font-mono">NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</p>
                <p className="font-mono">NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</p>
                <p className="font-mono">NEXT_PUBLIC_FIREBASE_APP_ID</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-950/60 p-6 text-sm text-slate-300">
              <h2 className="text-lg font-semibold text-white">Platform Features</h2>
              <ul className="mt-4 space-y-3">
                <li>• Secure user authentication and account management</li>
                <li>• Create and track support tickets in real-time</li>
                <li>• Instant confirmation with ticket reference numbers</li>
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

            <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl sm:p-10">
              <div className="mb-8 border-b border-slate-700/40 pb-8">
                <div>
                  <h2 className="text-center text-lg font-bold text-white tracking-wide">ACCOUNT ACCESS</h2>
                  <p className="mt-2 text-center text-sm text-slate-400">
                    {mode === "login" ? "Authenticate to access your support portal" : "Register a new account to begin"}
                  </p>
                </div>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleAuthSubmit}>
                <label className="block space-y-2.5 text-sm font-medium text-slate-200">
                  <span className="text-xs uppercase tracking-wider text-slate-400">Email Address</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block space-y-2.5 text-sm font-medium text-slate-200">
                  <span className="text-xs uppercase tracking-wider text-slate-400">Password</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                    placeholder="Minimum 6 characters"
                  />
                </label>
                {authError ? (
                  <p className="rounded-lg border border-rose-500/50 bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-100">
                    {authError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={loadingAuth}
                  className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-bold text-slate-950 transition shadow-lg shadow-cyan-500/40 hover:bg-cyan-400 hover:shadow-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none uppercase tracking-wide"
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
                        Register here
                      </button>
                    </>
                  ) : (
                    <>
                      Have an existing account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
                      >
                        Sign in here
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-8 border-t border-slate-700/40 pt-8">
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

  // Redirect admin users to admin page
  if (user && userRole === "admin") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Redirecting to admin dashboard...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_85%_85%,_rgba(14,165,233,0.2),_transparent_34%),linear-gradient(180deg,_#040b15_0%,_#071223_44%,_#0e1a30_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-6 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 space-y-8">
          <header className="flex items-center justify-between gap-6 border-b border-slate-700/30 pb-8">
            <div className="max-w-[300px]">
              <BrandLogo />
            </div>
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">{user.email ?? "Guest User"}</span>
              <span className="mx-3 text-slate-600">•</span>
                <button type="button" onClick={handleSignOut} className="font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline">
                Sign out
              </button>
            </div>
          </header>

          <div>
            <article className="flex items-center justify-between gap-12">
              <div className="flex-1 space-y-6">
                <h2 className="text-5xl font-bold tracking-tight text-white leading-tight">
                  Welcome to<br />
                  <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent font-extrabold">KLSB Support Services</span>
                </h2>
                <p className="text-base leading-relaxed text-slate-300/95 max-w-md">
                  Access our comprehensive support system with intelligent ticket management. Each request receives a unique reference number for streamlined tracking and resolution management.
                </p>
              </div>

              <div className="flex flex-col gap-4 min-w-max">
                <button
                  type="button"
                  onClick={() => router.push("/report")}
                  className="group relative rounded-lg bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.4),0_0_0_1px_rgba(125,249,255,0.4)] transition-all duration-300 hover:shadow-[0_20px_56px_rgba(34,211,238,0.55)] hover:-translate-y-1 active:translate-y-0 overflow-hidden uppercase tracking-wider"
                >
                  <span className="relative z-10">Report an Issue</span>
                  <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/status")}
                  className="group relative rounded-lg bg-gradient-to-br from-lime-500/50 via-lime-400/40 to-green-500/50 border border-lime-300/50 px-6 py-3 text-sm font-bold text-lime-50 shadow-[0_16px_40px_rgba(132,204,22,0.35),0_0_0_1px_rgba(168,226,46,0.3)] transition-all duration-300 hover:shadow-[0_20px_56px_rgba(132,204,22,0.45)] hover:-translate-y-1 active:translate-y-0 overflow-hidden backdrop-blur-sm uppercase tracking-wider"
                >
                  <span className="relative z-10">Check Status</span>
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
              </div>
            </article>
          </div>
      </section>
    </main>
  );
}
