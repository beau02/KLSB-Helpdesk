"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getAuth,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  where,
} from "firebase/firestore";
import { auth, db, firebaseConfig, firebaseReady } from "@/lib/firebase";

const adminRegistrationApp = getApps().some((candidate) => candidate.name === "admin-registration")
  ? getApp("admin-registration")
  : initializeApp(firebaseConfig, "admin-registration");

const adminRegistrationAuth = getAuth(adminRegistrationApp);

type AdminForm = {
  email: string;
  password: string;
  confirmPassword: string;
};

const defaultForm: AdminForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

export default function AdminRegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AdminForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const BrandLogo = () => (
    <img src="/klsb-logo.png" alt="KLSB Kemuncak Lanai SDN BHD" className="h-auto w-48" />
  );

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        router.push("/");
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!user || !db) return;

    const userQuery = query(collection(db, "users"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      userQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data() as DocumentData;
          const role = String(userData.role ?? "user");
          setIsAdmin(role === "admin");
          if (role !== "admin") {
            router.push("/");
          }
        } else {
          setIsAdmin(false);
          router.push("/");
        }
        setLoading(false);
      },
      (error) => {
        if (error.code === "permission-denied" && !auth?.currentUser) {
          return;
        }
        console.error("Admin registration role listener error:", error);
      },
    );

    return unsubscribe;
  }, [router, user]);

  const handleCreateAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (!db || !user || !isAdmin) {
      setMessage("You must be logged in as an admin to create another admin account.");
      return;
    }

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password || !form.confirmPassword) {
      setMessage("All fields are required.");
      return;
    }

    if (password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const createdCredential = await createUserWithEmailAndPassword(adminRegistrationAuth, email, password);

      await setDoc(doc(collection(db, "users")), {
        uid: createdCredential.user.uid,
        email: createdCredential.user.email,
        role: "admin",
        createdAt: serverTimestamp(),
        createdBy: user.email ?? "",
      });

      await signOut(adminRegistrationAuth).catch(() => undefined);

      setForm(defaultForm);
      setSuccess(true);
      setMessage(`Admin account created successfully for ${email}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create admin account.";
      setMessage(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!firebaseReady || !auth || !db) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Loading...</p>
        </section>
      </main>
    );
  }

  if (!user || loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Loading...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Access denied.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_85%_85%,_rgba(14,165,233,0.2),_transparent_34%),linear-gradient(180deg,_#040b15_0%,_#071223_44%,_#0e1a30_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-6 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="mb-12 flex items-center justify-between gap-6 border-b border-slate-700/30 pb-8">
          <BrandLogo />
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 hover:text-cyan-100"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <h1 className="text-3xl font-bold text-white mb-2">Register New Admin</h1>
          <p className="text-slate-400 mb-8">Create a new admin account and save it to the users collection.</p>

          <form onSubmit={handleCreateAdmin} className="space-y-5">
            <label className="block space-y-2 text-sm font-medium text-slate-200">
              <span className="text-xs uppercase tracking-wider text-slate-400">Admin Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-200">
              <span className="text-xs uppercase tracking-wider text-slate-400">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-200">
              <span className="text-xs uppercase tracking-wider text-slate-400">Confirm Password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                required
              />
            </label>

            {message && (
              <p
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  success
                    ? "border-green-500/40 bg-green-500/20 text-green-100"
                    : "border-rose-500/40 bg-rose-500/20 text-rose-100"
                }`}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-500 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none uppercase tracking-wide"
            >
              {submitting ? "Creating..." : "Create Admin Account"}
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-lg border border-slate-700/30 bg-slate-900/20 p-6">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Notes</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>✓ This creates a Firebase Auth account for the new admin</li>
            <li>✓ The account is also saved in Firestore with role set to admin</li>
            <li>✓ Your current admin session stays signed in</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
