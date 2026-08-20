"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import type { PublicQuestion } from "@/types/database";

// ============================================================
// CATATAN PERBAIKAN dari audit code.gs/index.html lama:
//
// BUG #1 (kritis) - debouncedSync() di index.html lama memanggil
// dirinya sendiri di dalam setTimeout, TIDAK PERNAH benar-benar
// mengirim jawaban ke server. Di bawah ini, `syncNow()` benar-benar
// melakukan fetch ke /api/responses/sync, dipanggil lewat debounce
// yang benar (useRef timer + call asli, bukan rekursi ke diri sendiri).
//
// BUG #2 (kritis) - executeSubmission() di index.html lama langsung
// menampilkan "Ujian Selesai!" tanpa mengecek response.success dari
// server, dan tidak ada penanganan error jaringan sama sekali.
// Di bawah ini, handleSubmit() SELALU mengecek result.success dulu,
// dan try/catch menangani kegagalan jaringan dengan pesan yang jelas
// serta OPSI COBA LAGI - bukan langsung dianggap berhasil.
// ============================================================

export default function ExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch(`/api/exams/${examId}/questions`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal memuat soal");
        setQuestions(data.questions);
      } catch (err: any) {
        Swal.fire("Gagal memuat ujian", err.message, "error");
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [examId]);

  // Ini fungsi sync YANG SESUNGGUHNYA - benar-benar mengirim ke server,
  // beda dari debouncedSync() lama yang cuma memanggil dirinya sendiri.
  const syncNow = useCallback(async () => {
    setSyncStatus("saving");
    try {
      const res = await fetch("/api/responses/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, answers: answersRef.current }),
      });
      const result = await res.json();
      setSyncStatus(result.status === "success" ? "saved" : "error");
    } catch {
      setSyncStatus("error");
    }
  }, [examId]);

  function scheduleSync() {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncNow();
    }, 3000);
  }

  function updateAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    scheduleSync();
  }

  async function handleSubmit(statusLabel: "Selesai" | "Curang") {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setSubmitting(true);

    try {
      const res = await fetch("/api/responses/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, answers: answersRef.current, statusLabel }),
      });
      const result = await res.json();

      // WAJIB cek success di sini - inilah perbaikan bug #2.
      if (!res.ok || !result.success) {
        setSubmitting(false);
        const confirm = await Swal.fire({
          icon: "error",
          title: "Gagal menyimpan jawaban",
          text: result.message ?? "Terjadi kesalahan di server. Jawaban Anda BELUM tersimpan.",
          showCancelButton: true,
          confirmButtonText: "Coba lagi",
          cancelButtonText: "Nanti dulu",
        });
        if (confirm.isConfirmed) handleSubmit(statusLabel);
        return;
      }

      await Swal.fire({
        icon: statusLabel === "Curang" ? "warning" : "success",
        title: statusLabel === "Curang" ? "Ujian Dihentikan" : "Ujian Selesai!",
        text:
          statusLabel === "Curang"
            ? "Pelanggaran terdeteksi, jawaban Anda telah dikunci dan disimpan."
            : "Jawaban Anda telah berhasil disimpan.",
      });
      router.push("/result");
    } catch (err) {
      // Kegagalan jaringan murni - dulu tidak tertangani sama sekali.
      setSubmitting(false);
      const confirm = await Swal.fire({
        icon: "error",
        title: "Koneksi bermasalah",
        text: "Tidak dapat menghubungi server. Periksa koneksi internet Anda lalu coba lagi.",
        showCancelButton: true,
        confirmButtonText: "Coba lagi",
        cancelButtonText: "Nanti dulu",
      });
      if (confirm.isConfirmed) handleSubmit(statusLabel);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat soal ujian...</div>;
  if (questions.length === 0) return <div className="p-8 text-center text-slate-500">Tidak ada soal.</div>;

  const q = questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4 text-sm text-slate-500">
          <span>
            Soal {currentIndex + 1} dari {questions.length}
          </span>
          <span>
            {syncStatus === "saving" && "Menyimpan..."}
            {syncStatus === "saved" && "✓ Tersimpan"}
            {syncStatus === "error" && "⚠ Gagal sinkron, akan dicoba lagi"}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <div className="mb-4" dangerouslySetInnerHTML={{ __html: q.content }} />

          {q.type === "PG" && Array.isArray(q.options) && (
            <div className="space-y-2">
              {(q.options as string[]).map((opt, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === opt}
                    onChange={() => updateAnswer(q.id, opt)}
                  />
                  <span dangerouslySetInnerHTML={{ __html: opt }} />
                </label>
              ))}
            </div>
          )}

          {/* Tipe soal PG_KOMPLEKS / BS / JODOH / ESAI mengikuti pola yang sama:
              render sesuai q.options, panggil updateAnswer(q.id, value) saat berubah.
              Dipersingkat di sini - struktur lengkapnya mengikuti komponen per tipe
              di components/exam/ sesuai struktur folder yang sudah disepakati. */}
        </div>

        <div className="flex justify-between gap-3">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => i - 1)}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
          >
            Sebelumnya
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
            >
              Berikutnya
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={() => handleSubmit("Selesai")}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
            >
              {submitting ? "Mengirim..." : "Selesai & Kumpulkan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
