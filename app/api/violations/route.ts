import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { examId, details } = await request.json();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Tetap paksa submit di sisi client walau sesi sudah habis
    return NextResponse.json({ forceSubmit: true }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) {
    return NextResponse.json({ forceSubmit: true }, { status: 400 });
  }

  // Ambil response_id + violation_count saat ini (kalau sudah ada baris in_progress)
  const { data: response } = await supabase
    .from("responses")
    .select("id, violation_count")
    .eq("user_id", profile.id)
    .eq("exam_id", examId)
    .maybeSingle();

  await supabase.from("violation_logs").insert({
    response_id: response?.id ?? null,
    user_id: profile.id,
    exam_id: examId,
    details: details ?? "Pelanggaran terdeteksi",
  });

  if (response?.id) {
    await supabase
      .from("responses")
      .update({ violation_count: (response.violation_count ?? 0) + 1 })
      .eq("id", response.id);
  }

  return NextResponse.json({ forceSubmit: true });
}
