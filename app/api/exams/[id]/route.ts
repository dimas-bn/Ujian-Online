import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
  return profile?.role === "admin";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const { data, error } = await db
    .from("exams")
    .select("*, exam_classes(class_id)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 404 });
  return NextResponse.json({ exam: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = createServiceRoleClient();

  // Update kolom dasar (hanya field yang dikirim)
  const updatable: Record<string, unknown> = {};
  for (const key of ["subject_id", "start_date", "end_date", "duration_minutes", "pin", "status"]) {
    if (key in body) updatable[key] = body[key];
  }

  if (Object.keys(updatable).length > 0) {
    const { error } = await db.from("exams").update(updatable).eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  }

  // Kalau ada perubahan daftar kelas, hapus semua link lama lalu buat ulang
  if (Array.isArray(body.class_ids)) {
    await db.from("exam_classes").delete().eq("exam_id", id);
    if (body.class_ids.length > 0) {
      const { error: linkError } = await db
        .from("exam_classes")
        .insert(body.class_ids.map((class_id: string) => ({ exam_id: id, class_id })));
      if (linkError) return NextResponse.json({ message: linkError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const db = createServiceRoleClient();
  const { error } = await db.from("exams").delete().eq("id", id);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
