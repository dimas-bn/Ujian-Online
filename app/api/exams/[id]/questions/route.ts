import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Pengganti getExamQuestions() di code.gs.
// Kolom correct_answer sengaja TIDAK di-select sama sekali di sini -
// bukan cuma disembunyikan di UI seperti risiko pada string HTML lama,
// tapi memang tidak pernah keluar dari database ke response JSON ini.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const examId = (await params).id;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 });
  }

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, exam_id, type, content, image_url, options, is_required, weight, order_index")
    .eq("exam_id", examId)
    .order("order_index", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions });
}
