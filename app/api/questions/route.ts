import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "guru")) return null;
  return profile;
}

// GET /api/questions?exam_id=xxx
// Catatan: ini endpoint KHUSUS ADMIN/GURU - correct_answer sengaja IKUT
// dikirim di sini (beda dari /api/exams/[id]/questions yang dipakai siswa
// saat ujian, yang sengaja tidak menyertakan kolom ini sama sekali).
export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  const examId = new URL(request.url).searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ message: "exam_id wajib diisi." }, { status: 400 });

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("exam_id", examId)
    .order("order_index", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ questions: data });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  const { exam_id, type, content, options, correct_answer, weight, is_required } = await request.json();

  if (!exam_id || !type || !content) {
    return NextResponse.json({ message: "exam_id, type, dan content wajib diisi." }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("questions")
    .insert({
      exam_id,
      type,
      content,
      options: options ?? null,
      correct_answer: correct_answer ?? null,
      weight: weight ?? 10,
      is_required: is_required ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ question: data });
}
