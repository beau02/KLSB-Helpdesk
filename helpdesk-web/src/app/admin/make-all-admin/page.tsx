"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  setDoc,
  collection,
  getDocs,
  doc,
  query,
  where,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";

export default function MakeAllAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [usersUpdated, setUsersUpdated] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

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

  const handleMakeAllAdmin = async () => {
    if (!db || !user) return;

    setProcessing(true);
    setMessage("Processing...");
    setUsersUpdated(0);

    try {
      // Get all known users from profiles and tickets.
      const usersSnapshot = await getDocs(collection(db, "users"));
      const ticketsSnapshot = await getDocs(collection(db, "tickets"));

      const targets = new Map<string, string>();

      for (const userDoc of usersSnapshot.docs) {
        const data = userDoc.data();
        const uid = typeof data.uid === "string" && data.uid.trim() ? data.uid : userDoc.id;
        const email = typeof data.email === "string" ? data.email : "";
        if (uid) targets.set(uid, email);
      }

      for (const ticketDoc of ticketsSnapshot.docs) {
        const data = ticketDoc.data();
        const uid = typeof data.userId === "string" ? data.userId : "";
        const email = typeof data.userEmail === "string" ? data.userEmail : "";
        if (uid && !targets.has(uid)) {
          targets.set(uid, email);
        }
      }

      if (!targets.has(user.uid)) {
        targets.set(user.uid, user.email || "");
      }

      setTotalUsers(targets.size);

      let updated = 0;
      for (const [uid, email] of targets.entries()) {
        await setDoc(
          doc(db, "users", uid),
          {
            uid,
            email,
            role: "admin",
          },
          { merge: true },
        );

        updated++;
        setUsersUpdated(updated);
      }

      setMessage(`✓ Success! Made ${updated} user(s) admin`);
      setProcessing(false);

      setTimeout(() => {
        router.push("/admin");
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update users";
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
          <h1 className="text-3xl font-bold text-white mb-2">Make All Users Admin</h1>
          <p className="text-slate-400 mb-8">Convert all users in the database to admin role</p>

          <div className="space-y-6">
            {/* User Info */}
            <div className="border-t border-slate-700/30 pt-6">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Your Email</p>
              <p className="text-lg text-white font-semibold">{user.email}</p>
            </div>

            {/* Current Role */}
            <div className="border-t border-slate-700/30 pt-6">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Your Role</p>
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

            {/* Warning Message */}
            <div className="border-t border-slate-700/30 pt-6 rounded-lg p-4 bg-orange-500/20 border border-orange-500/40">
              <p className="text-orange-200 text-sm mb-2">⚠️ Warning</p>
              <p className="text-orange-100 text-sm">
                This action will make ALL users in your database admin. This cannot be easily undone. Make sure you understand the consequences.
              </p>
            </div>

            {/* Progress */}
            {processing && (
              <div className="border-t border-slate-700/30 pt-6">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Progress</p>
                <div className="w-full bg-slate-700/30 rounded-lg h-2 mb-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-lg transition-all duration-300"
                    style={{
                      width: `${totalUsers > 0 ? (usersUpdated / totalUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-slate-300">
                  Updated {usersUpdated} of {totalUsers} users
                </p>
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                className={`border-t border-slate-700/30 pt-6 rounded-lg p-4 ${
                  message.includes("Success")
                    ? "bg-green-500/20 border border-green-500/40"
                    : message.includes("Error")
                    ? "bg-rose-500/20 border border-rose-500/40"
                    : "bg-cyan-500/20 border border-cyan-500/40"
                }`}
              >
                <p
                  className={
                    message.includes("Success")
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
              {!processing ? (
                <button
                  onClick={handleMakeAllAdmin}
                  disabled={processing}
                  className="w-full rounded-lg bg-gradient-to-br from-orange-500 via-orange-400 to-orange-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/40 hover:shadow-orange-500/60 transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none uppercase tracking-wide"
                >
                  Make All Users Admin
                </button>
              ) : (
                <button
                  disabled
                  className="w-full rounded-lg bg-slate-700/50 px-6 py-3 font-bold text-slate-300 uppercase tracking-wide cursor-not-allowed"
                >
                  Processing...
                </button>
              )}
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full rounded-lg bg-slate-700/30 px-6 py-3 font-bold text-slate-200 shadow-lg transition-all hover:bg-slate-700/50 uppercase tracking-wide"
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
