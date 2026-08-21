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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const { name } = await request.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ message: "Nama kelas tidak boleh kosong." }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("classes")
    .update({ name: String(name).trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ class: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const db = createServiceRoleClient();
  const { error } = await db.from("classes").delete().eq("id", id);

  if (error) {
    // Biasanya gagal karena kelas masih dipakai siswa/ujian lain (foreign key) -
    // ini justru bagus, mencegah data siswa "yatim" tanpa kelas.
    return NextResponse.json(
      { message: "Gagal menghapus - kelas ini masih dipakai oleh siswa atau ujian lain." },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true });
}
