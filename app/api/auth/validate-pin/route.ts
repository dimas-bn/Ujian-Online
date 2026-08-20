import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { pin } = await request.json();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ valid: false, message: "Sesi tidak valid, silakan login ulang." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, class_id")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !profile.class_id) {
    return NextResponse.json({ valid: false, message: "Data kelas siswa tidak ditemukan." }, { status: 400 });
  }

  // Cari ujian dengan PIN yang cocok DAN kelas siswa termasuk exam_classes-nya
  const { data: exam, error } = await supabase
    .from("exams")
    .select("id, status, start_date, end_date, duration_minutes, exam_classes!inner(class_id)")
    .eq("pin", String(pin).trim())
    .eq("exam_classes.class_id", profile.class_id)
    .maybeSingle();

  if (error || !exam) {
    return NextResponse.json({ valid: false, message: "PIN salah, kelas tidak sesuai, atau ujian tidak aktif." });
  }

  const now = new Date();

  if (exam.status !== "aktif") {
    // Tetap izinkan lihat hasil kalau statusnya 'selesai' (mirip viewResultsOnly di code.gs lama)
    if (exam.status === "selesai") {
      return NextResponse.json({ valid: true, examId: exam.id, viewResultsOnly: true });
    }
    return NextResponse.json({ valid: false, message: "Ujian belum aktif." });
  }

  if (now < new Date(exam.start_date)) {
    return NextResponse.json({ valid: false, message: "Ujian belum dimulai. Harap tunggu." });
  }

  if (exam.end_date && now > new Date(exam.end_date)) {
    return NextResponse.json({ valid: false, message: "Waktu ujian telah berakhir." });
  }

  return NextResponse.json({ valid: true, examId: exam.id });
}
