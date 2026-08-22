import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "guru")) return null;

  return profile;
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("exams")
    .select("*, subjects(id, name), exam_classes(class_id, classes(id, name))")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ exams: data });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ message: "Hanya admin yang boleh membuat ujian." }, { status: 403 });
  }

  const { subject_id, class_ids, start_date, end_date, duration_minutes, pin } = await request.json();

  if (!subject_id || !start_date || !duration_minutes || !pin || !Array.isArray(class_ids) || class_ids.length === 0) {
    return NextResponse.json({ message: "Semua field wajib diisi, minimal 1 kelas dipilih." }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: exam, error } = await db
    .from("exams")
    .insert({
      subject_id,
      created_by: staff.id,
      start_date,
      end_date: end_date || null,
      duration_minutes: Number(duration_minutes),
      pin: String(pin).trim(),
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const { error: linkError } = await db
    .from("exam_classes")
    .insert(class_ids.map((class_id: string) => ({ exam_id: exam.id, class_id })));

  if (linkError) {
    // Rollback manual - hapus ujian yang baru dibuat kalau gagal link kelas
    await db.from("exams").delete().eq("id", exam.id);
    return NextResponse.json({ message: "Gagal menautkan kelas: " + linkError.message }, { status: 400 });
  }

  return NextResponse.json({ exam });
}
