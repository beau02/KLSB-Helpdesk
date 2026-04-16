"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";

export default function PromoteCurrentUserPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const BrandLogo = () => (
    <img src="/klsb-logo.png" alt="KLSB Kemuncak Lanai SDN BHD" className="h-auto w-48" />
  );

  useEffect(() => {
    if (!auth) return;

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

    // Check user role
    const userQuery = query(collection(db, "users"), where("uid", "==", user.uid));
    getDocs(userQuery).then((snapshot) => {
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setUserRole(userData.role || "user");
      }
      setLoading(false);
    });
  }, [user]);

  const handlePromoteCurrentUser = async () => {
    if (!user || !db) return;

    setProcessing(true);
    setMessage("Processing...");

    try {
      // Find current user document
      const userQuery = query(collection(db, "users"), where("uid", "==", user.uid));
      const snapshot = await getDocs(userQuery);

      if (!snapshot.empty) {
        const userDocRef = doc(db, "users", snapshot.docs[0].id);
        await updateDoc(userDocRef, {
          role: "admin",
        });

        setUserRole("admin");
        setMessage("✓ Success! You are now an admin!");
        setSuccess(true);
        setProcessing(false);

        setTimeout(() => {
          router.push("/admin");
        }, 2000);
      } else {
        setMessage("✗ Error: User document not found");
        setProcessing(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update role";
      setMessage("✗ Error: " + errorMessage);
      setProcessing(false);
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

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Redirecting...</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_45%,_#1f2937)] px-6 py-10 text-slate-100 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <p className="text-center text-slate-300">Loading...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_85%_85%,_rgba(14,165,233,0.2),_transparent_34%),linear-gradient(180deg,_#040b15_0%,_#071223_44%,_#0e1a30_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-6 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="mb-12">
          <BrandLogo />
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <h1 className="text-3xl font-bold text-white mb-2">Make You Admin</h1>
          <p className="text-slate-400 mb-8">Promote your account to admin role</p>

          <div className="space-y-6">
            {/* User Info */}
            <div className="border-t border-slate-700/30 pt-6">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Your Email</p>
              <p className="text-lg text-white font-semibold">{user.email}</p>
            </div>

            {/* Current Role */}
            <div className="border-t border-slate-700/30 pt-6">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Current Role</p>
              <span
                className={`inline-flex px-4 py-2 rounded-lg text-sm font-bold ${
                  userRole === "admin"
                    ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50"
                    : "bg-slate-700/30 text-slate-200 border border-slate-600/50"
                }`}
              >
                {userRole === "admin" ? "👑 ADMIN" : "👤 USER"}
              </span>
            </div>

            {/* Info Message */}
            <div className="border-t border-slate-700/30 pt-6 rounded-lg p-4 bg-blue-500/20 border border-blue-500/40">
              <p className="text-blue-200 text-sm">
                ℹ️ Only your account ({user.email}) will be promoted to admin. All other users will remain as normal users.
              </p>
            </div>

            {/* Status Message */}
            {message && (
              <div
                className={`border-t border-slate-700/30 pt-6 rounded-lg p-4 ${
                  success
                    ? "bg-green-500/20 border border-green-500/40"
                    : message.includes("Error")
                    ? "bg-rose-500/20 border border-rose-500/40"
                    : "bg-cyan-500/20 border border-cyan-500/40"
                }`}
              >
                <p
                  className={
                    success
                      ? "text-green-200"
                      : message.includes("Error")
                      ? "text-rose-200"
                      : "text-cyan-200"
                  }
                >
                  {message}
                </p>
              </div>
            )}

            {/* Action Button */}
            <div className="border-t border-slate-700/30 pt-6">
              {!success && userRole === "user" ? (
                <button
                  onClick={handlePromoteCurrentUser}
                  disabled={processing}
                  className="w-full rounded-lg bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-500 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none uppercase tracking-wide"
                >
                  {processing ? "Processing..." : "Promote Me to Admin"}
                </button>
              ) : userRole === "admin" ? (
                <button
                  onClick={() => router.push("/admin")}
                  className="w-full rounded-lg bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-500 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all hover:-translate-y-1 uppercase tracking-wide"
                >
                  Go to Admin Dashboard
                </button>
              ) : null}
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full rounded-lg bg-slate-700/30 px-6 py-3 font-bold text-slate-200 shadow-lg transition-all hover:bg-slate-700/50 uppercase tracking-wide"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-slate-700/30 bg-slate-900/20 p-6">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">How It Works</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>✓ Only your account will be promoted to admin</li>
            <li>✓ Other users stay as normal users</li>
            <li>✓ You can access the admin dashboard after promotion</li>
            <li>✓ You can add more admins through the admin dashboard later</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
