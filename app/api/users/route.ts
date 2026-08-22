import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Konvensi yang sama persis dipakai di app/login/page.tsx - UserID pendek
// (mis. "siswa01") dipetakan jadi email sintetis untuk Supabase Auth, supaya
// siswa/guru cukup ingat UserID, tidak perlu punya email sungguhan.
function userCodeToEmail(userCode: string) {
  return `${userCode.trim().toLowerCase()}@ujiand.web.id`;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
  return profile?.role === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("users")
    .select("*, classes(id, name)")
    .order("role")
    .order("name");

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const { user_code, name, role, class_id, password } = await request.json();

  if (!user_code || !name || !role || !password) {
    return NextResponse.json({ message: "UserID, nama, role, dan password wajib diisi." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ message: "Password minimal 6 karakter." }, { status: 400 });
  }
  if (role === "siswa" && !class_id) {
    return NextResponse.json({ message: "Siswa wajib memiliki kelas." }, { status: 400 });
  }

  const db = createServiceRoleClient();

  // Langkah 1: buat akun Auth
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: userCodeToEmail(user_code),
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const message = authError?.message.includes("already registered")
      ? "UserID sudah dipakai."
      : authError?.message ?? "Gagal membuat akun.";
    return NextResponse.json({ message }, { status: 400 });
  }

  // Langkah 2: buat profil di tabel users, ditautkan ke akun Auth di atas
  const { data: profile, error: profileError } = await db
    .from("users")
    .insert({
      auth_id: authData.user.id,
      user_code: user_code.trim().toLowerCase(),
      name,
      role,
      class_id: role === "siswa" ? class_id : null,
      is_active: true,
    })
    .select()
    .single();

  if (profileError) {
    // Rollback - jangan sampai ada akun Auth "yatim" tanpa profil
    await db.auth.admin.deleteUser(authData.user.id);
    const message = profileError.message.includes("duplicate") ? "UserID sudah dipakai." : profileError.message;
    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({ user: profile });
}
