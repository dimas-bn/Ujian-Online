"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createClient } from "@/lib/supabase/client";

// Supabase Auth mewajibkan format email. Karena aplikasi lama pakai
// UserID pendek (ADM-001, SIS-001, dst), kita petakan otomatis jadi
// email sintetis di bawah tenda - siswa/guru/admin tetap cukup mengetik
// UserID seperti biasa, tidak perlu tahu soal email ini.
function userCodeToEmail(userCode: string) {
  return `${userCode.trim().toLowerCase()}@ujiand.web.id`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userCode, setUserCode] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: userCodeToEmail(userCode),
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      Swal.fire("Gagal", "UserID atau password salah.", "error");
      return;
    }

    // Ambil profil dari tabel users (role, status aktif, dst)
    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", data.user.id)
      .single();

    setLoading(false);

    if (profileErr || !profile) {
      Swal.fire("Gagal", "Data akun tidak ditemukan.", "error");
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      Swal.fire("Ditolak", "Akun dinonaktifkan.", "error");
      return;
    }

    if (profile.role === "siswa") {
      // Siswa perlu memasukkan PIN ujian setelah login berhasil
      setNeedsPin(true);
      return;
    }

    // Admin / Guru langsung ke dashboard
    router.push("/admin");
  }

  async function handleValidatePin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/validate-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const result = await res.json();

    setLoading(false);

    if (!result.valid) {
      Swal.fire("PIN salah", result.message ?? "Periksa kembali PIN ujian.", "error");
      return;
    }

    router.push(`/exam/${result.examId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">Ujian Online</h1>

        {!needsPin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">UserID</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleValidatePin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">PIN Ujian</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 tracking-widest text-center"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
            >
              {loading ? "Memeriksa..." : "Mulai Ujian"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
