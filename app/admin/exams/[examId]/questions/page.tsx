"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";

interface Question {
  id: string;
  type: string;
  content: string;
  options: string[] | null;
  correct_answer: string | null;
  weight: number;
}

const HURUF = ["A", "B", "C", "D", "E"];

export default function QuestionBankPage() {
  const { examId } = useParams<{ examId: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [weight, setWeight] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    const res = await fetch(`/api/questions?exam_id=${examId}`);
    const data = await res.json();
    if (res.ok) setQuestions(data.questions);
    setLoading(false);
  }

  useEffect(() => {
    loadQuestions();
  }, [examId]);

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: examId,
        type: "PG",
        content,
        options: options.filter((o) => o.trim() !== ""),
        correct_answer: HURUF[correctIndex],
        weight,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      Swal.fire("Gagal", data.message ?? "Terjadi kesalahan.", "error");
      return;
    }

    setContent("");
    setOptions(["", "", "", ""]);
    setCorrectIndex(0);
    setWeight(10);
    loadQuestions();
  }

  async function handleDelete(q: Question) {
    const confirm = await Swal.fire({
      title: "Hapus soal ini?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    const res = await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
    if (res.ok) loadQuestions();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">Bank Soal</h1>
      <p className="text-slate-500 text-sm mb-6">
        Tambah soal Pilihan Ganda untuk ujian ini. Tipe soal lain (Benar/Salah, Menjodohkan, Esai) menyusul.
      </p>

      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Pertanyaan</label>
          <textarea
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Pilihan Jawaban</label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === idx}
                  onChange={() => setCorrectIndex(idx)}
                  title="Tandai sebagai jawaban benar"
                />
                <span className="w-5 text-sm font-medium text-slate-500">{HURUF[idx]}</span>
                <input
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`Pilihan ${HURUF[idx]}`}
                  required={idx < 2}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">Klik radio button di kiri untuk menandai jawaban yang benar.</p>
        </div>

        <div className="w-32">
          <label className="block text-sm font-medium text-slate-600 mb-1">Bobot Nilai</label>
          <input
            type="number"
            min={1}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Tambah Soal"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Memuat...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada soal.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-slate-700">
                  {i + 1}. {q.content}
                </p>
                <button onClick={() => handleDelete(q)} className="text-red-600 text-sm hover:underline shrink-0 ml-4">
                  Hapus
                </button>
              </div>
              <ul className="text-sm text-slate-500 space-y-0.5">
                {q.options?.map((opt, idx) => (
                  <li key={idx} className={HURUF[idx] === q.correct_answer ? "text-emerald-600 font-medium" : ""}>
                    {HURUF[idx]}. {opt} {HURUF[idx] === q.correct_answer && "✓"}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-2">Bobot: {q.weight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
