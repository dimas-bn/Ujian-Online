import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Perbaikan dari bug audit sebelumnya:
// 1. Tidak ada lagi LockService/scan manual - cukup satu UPSERT atomik
//    berkat constraint UNIQUE(user_id, exam_id) di schema.sql.
// 2. Sesi divalidasi otomatis oleh Supabase Auth (cookie) + RLS policy,
//    bukan parameter userID polos tanpa token seperti syncAnswers() lama.
export async function POST(request: Request) {
  const { examId, answers } = await request.json();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Sesi habis." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ status: "error", message: "Akun tidak ditemukan." }, { status: 400 });
  }

  const { error } = await supabase
    .from("responses")
    .upsert(
      {
        user_id: profile.id,
        exam_id: examId,
        answers,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exam_id" }
    );

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", message: "Jawaban tersimpan." });
}
