"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";

interface Subject {
  id: string;
  name: string;
}
interface ClassRow {
  id: string;
  name: string;
}
interface Exam {
  id: string;
  status: string;
  start_date: string;
  duration_minutes: number;
  pin: string;
  subjects: { name: string } | null;
  exam_classes: { classes: { name: string } }[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  aktif: "Aktif",
  non_aktif: "Non-Aktif",
  selesai: "Selesai",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  aktif: "bg-emerald-100 text-emerald-700",
  non_aktif: "bg-amber-100 text-amber-700",
  selesai: "bg-blue-100 text-blue-700",
};

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [subjectId, setSubjectId] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [examsRes, subjectsRes, classesRes] = await Promise.all([
      fetch("/api/exams"),
      fetch("/api/subjects"),
      fetch("/api/classes"),
    ]);
    const examsData = await examsRes.json();
    const subjectsData = await subjectsRes.json();
    const classesData = await classesRes.json();
    if (examsRes.ok) setExams(examsData.exams);
    if (subjectsRes.ok) setSubjects(subjectsData.subjects);
    if (classesRes.ok) setClasses(classesData.classes);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function toggleClass(id: string) {
    setSelectedClasses((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject_id: subjectId,
        class_ids: selectedClasses,
        start_date: startDate,
        duration_minutes: duration,
        pin,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      Swal.fire("Gagal", data.message ?? "Terjadi kesalahan.", "error");
      return;
    }

    setShowForm(false);
    setSubjectId("");
    setSelectedClasses([]);
    setStartDate("");
    setDuration(60);
    setPin("");
    loadAll();
  }

  async function toggleStatus(exam: Exam) {
    const next = exam.status === "aktif" ? "non_aktif" : "aktif";
    const res = await fetch(`/api/exams/${exam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) loadAll();
  }

  async function handleDelete(exam: Exam) {
    const confirm = await Swal.fire({
      title: "Hapus ujian ini?",
      text: "Semua soal di dalamnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    const res = await fetch(`/api/exams/${exam.id}`, { method: "DELETE" });
    if (res.ok) loadAll();
    else Swal.fire("Gagal", "Tidak dapat menghapus ujian.", "error");
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ujian</h1>
          <p className="text-slate-500 text-sm">Kelola daftar ujian dan bank soalnya.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          {showForm ? "Batal" : "+ Buat Ujian"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Mata Pelajaran</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            >
              <option value="">Pilih mapel...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Kelas Peserta</label>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleClass(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    selectedClasses.includes(c.id)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {classes.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">Belum ada data kelas - tambahkan dulu di Master Data.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Waktu Mulai</label>
              <input
                type="datetime-local"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Durasi (menit)</label>
              <input
                type="number"
                min={1}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">PIN Ujian</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="mis. 123456"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan Ujian"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Memuat...</p>
      ) : exams.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada ujian dibuat.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3">Mapel</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Mulai</th>
                <th className="px-4 py-3">Durasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td className="px-4 py-3">{exam.subjects?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    {exam.exam_classes.map((ec) => ec.classes.name).join(", ") || "-"}
                  </td>
                  <td className="px-4 py-3">{new Date(exam.start_date).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">{exam.duration_minutes} menit</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[exam.status]}`}>
                      {STATUS_LABEL[exam.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-3">
                    <Link href={`/admin/exams/${exam.id}/questions`} className="text-blue-600 hover:underline">
                      Bank Soal
                    </Link>
                    <button onClick={() => toggleStatus(exam)} className="text-emerald-600 hover:underline">
                      {exam.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button onClick={() => handleDelete(exam)} className="text-red-600 hover:underline">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
