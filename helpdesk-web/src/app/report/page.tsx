"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";

type ReportForm = {
  userName: string;
  contactNo: string;
  location: string;
  deviceType: string;
  model: string;
  serialNumber: string;
  issue: string;
};

const defaultForm: ReportForm = {
  userName: "",
  contactNo: "",
  location: "",
  deviceType: "Laptop",
  model: "",
  serialNumber: "",
  issue: "",
};

function formatTicketCode(value: number) {
  return `KLSB-${String(value).padStart(3, "0")}`;
}

function getTicketTimestamp(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const dateValue = (value as { toDate: () => Date }).toDate();
    return dateValue.getTime();
  }
  return 0;
}

export default function ReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<ReportForm>(defaultForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!db || !user) {
      setError("Sign in before creating a ticket.");
      return;
    }

    if (
      !form.userName.trim() ||
      !form.contactNo.trim() ||
      !form.location.trim() ||
      !form.deviceType.trim() ||
      !form.model.trim() ||
      !form.serialNumber.trim() ||
      !form.issue.trim()
    ) {
      setError("All fields are required.");
      return;
    }

    setSubmitting(true);

    try {
      if (!db) {
        setError("Database connection failed.");
        setSubmitting(false);
        return;
      }

      const autoReplyMessage = "Thank you for your report. We have received your submission and will contact you soon for further action.";
      const ticketNumber = Date.now();
      const ticketRef = doc(collection(db!, "tickets"));

      await setDoc(ticketRef, {
        ticketNumber,
        userId: user.uid,
        userEmail: user.email,
        userName: form.userName.trim(),
        contactNo: form.contactNo.trim(),
        location: form.location.trim(),
        deviceType: form.deviceType.trim(),
        model: form.model.trim(),
        serialNumber: form.serialNumber.trim(),
        issue: form.issue.trim(),
        status: "On Going",
        autoReply: autoReplyMessage,
        adminReply: "",
        assignedAdminEmail: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        repliedAt: null,
      });

      let ticketCode = ticketRef.id;
      try {
        const allTicketsSnapshot = await getDocs(collection(db, "tickets"));
        const allTickets = allTicketsSnapshot.docs
          .map((ticketDocument) => {
            const data = ticketDocument.data() as DocumentData;
            return {
              id: ticketDocument.id,
              ticketNumber: Number(data.ticketNumber ?? 0),
              createdAt: data.createdAt ?? null,
            };
          })
          .sort((a, b) => {
            const timeDiff = getTicketTimestamp(a.createdAt) - getTicketTimestamp(b.createdAt);
            if (timeDiff !== 0) return timeDiff;
            return a.ticketNumber - b.ticketNumber;
          });

        const ticketIndex = allTickets.findIndex((ticketItem) => ticketItem.id === ticketRef.id);
        if (ticketIndex >= 0) {
          ticketCode = formatTicketCode(ticketIndex + 1);
        }
      } catch {
        // Keep ticketRef.id fallback when global ordering cannot be resolved.
      }

      const notificationResponse = await fetch("/api/notifications/ticket-submitted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId: ticketRef.id,
          ticketCode,
          userEmail: user.email,
          subject: `${form.deviceType.trim()} - ${form.model.trim()}`,
          description: form.issue.trim(),
          priority: "Medium",
          autoReplyMessage,
          userName: form.userName.trim(),
          contactNo: form.contactNo.trim(),
          location: form.location.trim(),
          deviceType: form.deviceType.trim(),
          model: form.model.trim(),
          serialNumber: form.serialNumber.trim(),
          issue: form.issue.trim(),
        }),
      });

      if (!notificationResponse.ok) {
        const result = (await notificationResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Ticket was saved, but the email notification failed.");
      }

      setForm(defaultForm);
      setSuccess("You have succesfully submitted the ticket");
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit report.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
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
        <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 sm:p-10 lg:p-12">
            <p className="text-xl text-slate-300">Please sign in to submit a report.</p>
          </div>
        </section>
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
          <article className="max-w-4xl">
            <h1 className="text-5xl font-bold tracking-tight text-white leading-[1.15] mb-8">
              Report  <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent">Details</span>
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">Full Name <span className="text-rose-300">*</span></label>
                  <input
                    type="text"
                    value={form.userName}
                    onChange={(e) => setForm({ ...form, userName: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                    placeholder="Full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">Contact No. <span className="text-rose-300">*</span></label>
                  <input
                    type="tel"
                    value={form.contactNo}
                    onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                    placeholder="+60 12345678"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">Location <span className="text-rose-300">*</span></label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                    placeholder="City/Branch"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">Device Type <span className="text-rose-300">*</span></label>
                  <select
                    value={form.deviceType}
                    onChange={(e) => setForm({ ...form, deviceType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
                    required
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Desktop">Desktop</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">Model <span className="text-rose-300">*</span></label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                    placeholder="Device model"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">Serial Number <span className="text-rose-300">*</span></label>
                  <input
                    type="text"
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                    placeholder="S/N"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white">Report an Issue <span className="text-rose-300">*</span></label>
                <textarea
                  value={form.issue}
                  onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 resize-none"
                  placeholder="Describe the issue in detail..."
                  required
                />
              </div>

              {error && (
                <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </p>
              )}

              {success && (
                <p className="rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                  {success}
                </p>
              )}

              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-500 px-8 py-3 text-sm font-bold text-slate-900 shadow-[0_12px_32px_rgba(34,211,238,0.3),0_0_0_1px_rgba(125,249,255,0.2)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(34,211,238,0.4)] hover:-translate-y-1 active:translate-y-0 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10">{submitting ? "Submitting..." : "Submit Report"}</span>
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}
