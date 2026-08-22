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
  const { name, role, class_id, is_active, password } = await request.json();
  const db = createServiceRoleClient();

  // Kalau ada password baru, update dulu di sisi Auth
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ message: "Password minimal 6 karakter." }, { status: 400 });
    }
    const { data: profile } = await db.from("users").select("auth_id").eq("id", id).single();
    if (profile?.auth_id) {
      const { error: pwError } = await db.auth.admin.updateUserById(profile.auth_id, { password });
      if (pwError) return NextResponse.json({ message: pwError.message }, { status: 400 });
    }
  }

  const updatable: Record<string, unknown> = {};
  if (name !== undefined) updatable.name = name;
  if (role !== undefined) updatable.role = role;
  if (class_id !== undefined) updatable.class_id = role === "siswa" ? class_id : null;
  if (is_active !== undefined) updatable.is_active = is_active;

  if (Object.keys(updatable).length > 0) {
    const { error } = await db.from("users").update(updatable).eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const db = createServiceRoleClient();

  const { data: profile } = await db.from("users").select("auth_id").eq("id", id).single();

  const { error } = await db.from("users").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { message: "Gagal menghapus - pengguna ini mungkin masih punya riwayat jawaban ujian." },
      { status: 400 }
    );
  }

  // Hapus juga akun Auth-nya supaya tidak ada akun "yatim" yang bisa login
  // tapi tanpa profil.
  if (profile?.auth_id) {
    await db.auth.admin.deleteUser(profile.auth_id);
  }

  return NextResponse.json({ success: true });
}
