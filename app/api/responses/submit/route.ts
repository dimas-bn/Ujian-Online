import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

function stripHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const HURUF = ["A", "B", "C", "D", "E"];

// Porting logic scoring dari submitExam() di code.gs, disesuaikan ke bentuk
// tabel questions (options/correct_answer sudah berupa objek JS, bukan string
// JSON yang perlu di-parse manual seperti di Google Sheets).
function scoreQuestion(q: any, userAns: any): { earned: number; weight: number } {
  const weight = Number(q.weight ?? 10);

  if (q.type === "PG") {
    const cleanUser = stripHtml(userAns);
    const cleanKey = String(q.correct_answer ?? "").trim();
    const keyIndex = HURUF.indexOf(cleanKey.toUpperCase());
    let correctText = cleanKey;
    if (keyIndex !== -1 && Array.isArray(q.options) && q.options[keyIndex]) {
      correctText = stripHtml(q.options[keyIndex]);
    } else {
      correctText = stripHtml(cleanKey);
    }
    return { earned: cleanUser === correctText && correctText !== "" ? weight : 0, weight };
  }

  if (q.type === "PG_KOMPLEKS") {
    const keyArr: string[] = Array.isArray(q.correct_answer) ? q.correct_answer : [];
    const userArr: string[] = Array.isArray(userAns) ? userAns : [];
    const options: string[] = Array.isArray(q.options) ? q.options : [];

    const realKeyValues = keyArr
      .map((k) => {
        const idx = HURUF.indexOf(String(k).trim().toUpperCase());
        return idx !== -1 && options[idx] ? stripHtml(options[idx]) : stripHtml(k);
      })
      .filter((v) => v !== "");
    const realUserValues = userArr.map((u) => stripHtml(u)).filter((v) => v !== "");

    let match = 0;
    let wrong = 0;
    realUserValues.forEach((v) => (realKeyValues.includes(v) ? match++ : wrong++));

    if (wrong === 0 && match > 0 && realKeyValues.length > 0) {
      return { earned: (match / realKeyValues.length) * weight, weight };
    }
    return { earned: 0, weight };
  }

  if (q.type === "BS") {
    const keyObj = q.correct_answer && typeof q.correct_answer === "object" ? q.correct_answer : {};
    const ansObj = userAns && typeof userAns === "object" ? userAns : {};
    const totalRows = Object.keys(keyObj).length;
    if (totalRows === 0) return { earned: 0, weight };

    let matches = 0;
    for (const idx in keyObj) {
      const kVal = String(keyObj[idx]).trim().toLowerCase();
      const uVal = String(ansObj[idx] ?? "").trim().toLowerCase();
      if (kVal === uVal || (kVal === "benar" && uVal === "sesuai") || (kVal === "salah" && uVal === "tidak sesuai")) {
        matches++;
      }
    }
    return { earned: (matches / totalRows) * weight, weight };
  }

  if (q.type === "JODOH") {
    const pairs: { q: string; a: string }[] = Array.isArray(q.correct_answer) ? q.correct_answer : [];
    if (pairs.length === 0 || !userAns || typeof userAns !== "object") return { earned: 0, weight };
    let matches = 0;
    pairs.forEach((p) => {
      if (userAns[p.q] === p.a) matches++;
    });
    return { earned: (matches / pairs.length) * weight, weight };
  }

  // ESAI - dinilai manual oleh guru, poin otomatis 0 saat submit
  return { earned: 0, weight };
}

export async function POST(request: Request) {
  const { examId, answers, statusLabel } = await request.json();

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Sesi habis." }, { status: 401 });
  }

  const { data: profile } = await authClient.from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) {
    return NextResponse.json({ success: false, message: "Akun tidak ditemukan." }, { status: 400 });
  }

  // Butuh service role untuk membaca correct_answer (tidak boleh lewat client biasa/RLS publik)
  const db = createServiceRoleClient();
  const { data: questions, error: qErr } = await db.from("questions").select("*").eq("exam_id", examId);

  if (qErr || !questions) {
    return NextResponse.json({ success: false, message: "Gagal memuat soal untuk penilaian." }, { status: 500 });
  }

  let totalEarned = 0;
  let totalWeight = 0;
  for (const q of questions) {
    const { earned, weight } = scoreQuestion(q, answers[q.id]);
    totalEarned += earned;
    totalWeight += weight;
  }

  const finalScore = totalWeight > 0 ? Math.round((totalEarned / totalWeight) * 100) : 0;
  const finalStatus = statusLabel === "Curang" ? "curang" : "completed";

  const { error: upsertErr } = await db.from("responses").upsert(
    {
      user_id: profile.id,
      exam_id: examId,
      answers,
      score: finalScore,
      submit_time: new Date().toISOString(),
      status: finalStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,exam_id" }
  );

  if (upsertErr) {
    // PENTING: berbeda dari executeSubmission() lama di index.html,
    // frontend WAJIB mengecek field "success" ini sebelum menampilkan
    // halaman "Ujian Selesai!" - lihat catatan di README.md.
    return NextResponse.json({ success: false, message: "Gagal menyimpan: " + upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, score: finalScore });
}
